package dk.sdu.cloud.app.kubernetes.services

import dk.sdu.cloud.app.kubernetes.services.volcano.VOLCANO_JOB_NAME_LABEL
import dk.sdu.cloud.app.kubernetes.services.volcano.VolcanoJob
import dk.sdu.cloud.app.orchestrator.api.Job
import dk.sdu.cloud.app.orchestrator.api.networks
import dk.sdu.cloud.app.orchestrator.api.peers
import dk.sdu.cloud.defaultMapper
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.db.async.DBContext
import dk.sdu.cloud.service.db.async.sendPreparedStatement
import dk.sdu.cloud.service.db.async.withSession
import dk.sdu.cloud.service.k8.*
import io.ktor.http.*
import kotlinx.coroutines.delay
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.encodeToJsonElement

class FirewallPlugin(
    private val db: DBContext,
    private val gatewayCidr: String?,
) : JobManagementPlugin, Loggable {
    override val log = logger()

    @OptIn(ExperimentalStdlibApi::class)
    override suspend fun JobManagement.onCreate(job: Job, builder: VolcanoJob) {
        val namespace = k8.nameAllocator.jobIdToNamespace(job.id)

        val selectorForThisJob = LabelSelector().apply {
            matchLabels = JsonObject(mapOf(
                VOLCANO_JOB_NAME_LABEL to JsonPrimitive(k8.nameAllocator.jobIdToJobName(job.id))
            ))
        }

        if (job.peers.isNotEmpty()) {
            builder.spec?.tasks?.forEach { task ->
                val podSpec = task.template?.spec ?: return@forEach
                val aliases = ArrayList<Pod.HostAlias>()
                podSpec.hostAliases = aliases
                for (peer in job.peers) {
                    try {
                        val ip = k8.client.getResource<Pod>(
                            KubernetesResources.pod.withNameAndNamespace(
                                k8.nameAllocator.jobIdAndRankToPodName(peer.jobId, 0),
                                k8.nameAllocator.jobIdToNamespace(peer.jobId)
                            )
                        ).status?.podIP ?: continue

                        aliases.add(Pod.HostAlias(listOf(peer.hostname), ip))
                    } catch (ex: KubernetesException) {
                        if (ex.statusCode == HttpStatusCode.NotFound) {
                            log.debug(ex.stackTraceToString())
                        } else {
                            throw ex
                        }
                    }
                }
            }
        }

        val policyName = POLICY_PREFIX + job.id
        val newPolicy = NetworkPolicy().apply {
            metadata = ObjectMeta(policyName)

            spec = NetworkPolicy.Spec().apply {
                val ingress = ArrayList<NetworkPolicy.IngressRule>()
                val egress = ArrayList<NetworkPolicy.EgressRule>()
                this.ingress = ingress
                this.egress = egress

                for (peer in job.peers) {
                    val peerSelector = LabelSelector().apply {
                        matchLabels = JsonObject(mapOf(
                            VOLCANO_JOB_NAME_LABEL to JsonPrimitive(k8.nameAllocator.jobIdToJobName(peer.jobId)),
                        ))
                    }

                    egress.add(NetworkPolicy.EgressRule().apply {
                        to = listOf(NetworkPolicy.Peer().apply {
                            // (Client egress) Allow connections from client to peer
                            podSelector = peerSelector
                        })
                    })

                    ingress.add(NetworkPolicy.IngressRule().apply {
                        from = listOf(NetworkPolicy.Peer().apply {
                            // (Client ingress) Allow connections from peer to client
                            podSelector = peerSelector
                        })
                    })
                }

                if (job.networks.isNotEmpty()) {
                    val internalIps = db.withSession { session ->
                        session
                            .sendPreparedStatement(
                                { setParameter("job_id", job.id) },
                                """
                                    select internal_ip_address
                                      from app_kubernetes.bound_network_ips join 
                                           app_kubernetes.network_ips on app_kubernetes.bound_network_ips.network_ip_id = network_ips.id
                                     where job_id = :job_id
                                """
                            )
                            .rows
                            .map { it.getString(0)!! }
                    }

                    for (internalIp in internalIps) {
                        ingress.add(NetworkPolicy.IngressRule().apply {
                            from = listOf(NetworkPolicy.Peer().apply {
                                ipBlock = NetworkPolicy.IPBlock().apply {
                                    cidr = "${internalIp}/32"
                                }
                            })
                        })
                    }

                    if (gatewayCidr != null) {
                        ingress.add(NetworkPolicy.IngressRule().apply {
                            from = listOf(NetworkPolicy.Peer().apply {
                                ipBlock = NetworkPolicy.IPBlock().apply {
                                    cidr = gatewayCidr
                                }
                            })
                        })
                    }
                }

                if (job.peers.isEmpty()) {
                    // NOTE(Dan): Kubernetes will insert null instead of an empty list if we pass an empty list
                    // The JSON patch below will only work if the list is present and we cannot insert an empty list
                    // if it is not already present via JSON patch. As a result, we will insert a dummy entry which
                    // (hopefully) shouldn't have any effect.

                    // NOTE(Dan): The IP listed below is reserved for documentation (TEST-NET-1,
                    // see https://tools.ietf.org/html/rfc5737). Let's hope no one gets the bright idea to actually
                    // use this subnet in practice.

                    ingress.add(NetworkPolicy.IngressRule().apply {
                        from = listOf(NetworkPolicy.Peer().apply {
                            ipBlock = NetworkPolicy.IPBlock().apply {
                                cidr = INVALID_SUBNET
                            }
                        })
                    })

                    egress.add(NetworkPolicy.EgressRule().apply {
                        to = listOf(NetworkPolicy.Peer().apply {
                            ipBlock = NetworkPolicy.IPBlock().apply {
                                cidr = INVALID_SUBNET
                            }
                        })
                    })
                }

                podSelector = selectorForThisJob
            }
        }

        for (attempt in 1..5) {
            try {
                @Suppress("BlockingMethodInNonBlockingContext")
                k8.client.createResource(
                    KubernetesResources.networkPolicies.withNamespace(namespace),
                    defaultMapper.encodeToString(newPolicy)
                )

                break
            } catch (ex: KubernetesException) {
                if (ex.statusCode == HttpStatusCode.Conflict) {
                    k8.client.deleteResource(
                        KubernetesResources.networkPolicies.withNameAndNamespace(policyName, namespace)
                    )
                }

                delay(500)
            }
        }


        for (peer in job.peers) {
            // Visit all peers and edit their existing network policy

            // NOTE(Dan): Ignore any errors which indicate that the policy doesn't exist. Job probably just went down
            // before we were scheduled. Unclear if this needs to be an error, we are choosing not to consider it one
            // at the moment.

            try {
                @Suppress("BlockingMethodInNonBlockingContext")
                k8.client.patchResource(
                    KubernetesResources.networkPolicies.withNameAndNamespace(
                        POLICY_PREFIX + peer.jobId,
                        k8.nameAllocator.jobIdToNamespace(peer.jobId)
                    ),
                    defaultMapper.encodeToString(
                        listOf(
                            JsonObject(
                                mapOf(
                                    "op" to JsonPrimitive("add"),
                                    "path" to JsonPrimitive("/spec/ingress/-"),
                                    "value" to defaultMapper.encodeToJsonElement(
                                        NetworkPolicy.IngressRule().apply {
                                            from = listOf(NetworkPolicy.Peer().apply {
                                                podSelector = selectorForThisJob
                                            })
                                        }
                                    )
                                )
                            ),
                            JsonObject(
                                JsonObject(
                                    mapOf(
                                        "op" to JsonPrimitive("add"),
                                        "path" to JsonPrimitive("/spec/egress/-"),
                                        "value" to defaultMapper.encodeToJsonElement(
                                            NetworkPolicy.EgressRule().apply {
                                                to = listOf(NetworkPolicy.Peer().apply {
                                                    podSelector = selectorForThisJob
                                                })
                                            }
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    ContentType("application", "json-patch+json")
                )
            } catch (ex: KubernetesException) {
                if (ex.statusCode == HttpStatusCode.NotFound || ex.statusCode == HttpStatusCode.BadRequest) {
                    // Generally ignored but log to debug in case this wasn't supposed to happen
                    log.debug(ex.stackTraceToString())
                } else {
                    throw ex
                }
            }
        }
    }

    override suspend fun JobManagement.onCleanup(jobId: String) {
        try {
            k8.client.deleteResource(
                KubernetesResources.networkPolicies.withNameAndNamespace(
                    POLICY_PREFIX + jobId,
                    k8.nameAllocator.jobIdToNamespace(jobId)
                )
            )
        } catch (ex: KubernetesException) {
            if (ex.statusCode == HttpStatusCode.BadRequest || ex.statusCode == HttpStatusCode.NotFound) {
                // Generally ignored but log to debug in case this wasn't supposed to happen
                log.trace("Failed to cleanup after $jobId. Resources does not exist.")
            } else {
                throw ex
            }
        }
    }

    companion object {
        const val POLICY_PREFIX = "policy-"
        private const val INVALID_SUBNET = "192.0.2.100/32"
    }
}
