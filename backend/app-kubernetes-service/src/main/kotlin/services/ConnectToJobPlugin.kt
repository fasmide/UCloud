package dk.sdu.cloud.app.kubernetes.services

import dk.sdu.cloud.app.kubernetes.services.volcano.VOLCANO_JOB_NAME_LABEL
import dk.sdu.cloud.app.kubernetes.services.volcano.VolcanoJob
import dk.sdu.cloud.app.orchestrator.api.Job
import dk.sdu.cloud.defaultMapper
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.k8.*
import io.ktor.http.*

object ConnectToJobPlugin : JobManagementPlugin, Loggable {
    override val log = logger()

    @OptIn(ExperimentalStdlibApi::class)
    override suspend fun JobManagement.onCreate(job: Job, builder: VolcanoJob) {
        /*
        val namespace = k8.nameAllocator.jobIdToNamespace(job.id)

        val selectorForThisJob = LabelSelector().apply {
            matchLabels = mapOf(
                VOLCANO_JOB_NAME_LABEL to k8.nameAllocator.jobIdToJobName(job.id)
            )
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

                        aliases.add(Pod.HostAlias(listOf(peer.name), ip))
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

        val newPolicy = NetworkPolicy().apply {
            metadata = ObjectMeta(POLICY_PREFIX + job.id)

            spec = NetworkPolicy.Spec().apply {
                val ingress = ArrayList<NetworkPolicy.IngressRule>()
                val egress = ArrayList<NetworkPolicy.EgressRule>()
                this.ingress = ingress
                this.egress = egress

                for (peer in job.peers) {
                    val peerSelector = LabelSelector().apply {
                        matchLabels = mapOf(
                            VOLCANO_JOB_NAME_LABEL to k8.nameAllocator.jobIdToJobName(peer.jobId)
                        )
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

        @Suppress("BlockingMethodInNonBlockingContext")
        k8.client.createResource(
            KubernetesResources.networkPolicies.withNamespace(namespace),
            defaultMapper.writeValueAsString(newPolicy)
        )


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
                    defaultMapper.writeValueAsString(
                        listOf(
                            mapOf(
                                "op" to "add",
                                "path" to "/spec/ingress/-",
                                "value" to NetworkPolicy.IngressRule().apply {
                                    from = listOf(NetworkPolicy.Peer().apply {
                                        podSelector = selectorForThisJob
                                    })
                                }
                            ),
                            mapOf(
                                "op" to "add",
                                "path" to "/spec/egress/-",
                                "value" to NetworkPolicy.EgressRule().apply {
                                    to = listOf(NetworkPolicy.Peer().apply {
                                        podSelector = selectorForThisJob
                                    })
                                }
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
         */
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

    const val POLICY_PREFIX = "policy-"
    private const val INVALID_SUBNET = "192.0.2.100/32"
}