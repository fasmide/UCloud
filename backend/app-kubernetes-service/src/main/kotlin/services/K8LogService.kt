package dk.sdu.cloud.app.kubernetes.services

import dk.sdu.cloud.app.kubernetes.services.volcano.VOLCANO_JOB_NAME_LABEL
import dk.sdu.cloud.file.api.bytesToString
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.Time
import dk.sdu.cloud.service.k8.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.utils.io.*
import io.ktor.utils.io.jvm.javaio.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.channels.produce
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files

/**
 * A service responsible for downloading and streaming of K8 logs from user jobs.
 */
class K8LogService(
    private val k8: K8Dependencies
) {
    @Deprecated("Replaced with useLogWatch", ReplaceWith("useLogWatch(requestId)"))
    fun retrieveLogs(requestId: String, startLine: Int, maxLines: Int): Pair<String, Int> {
        return Pair("", 0)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    fun useLogWatch(requestId: String): ReceiveChannel<String> {
        return k8.scope.produce {
            val jobName = k8.nameAllocator.jobIdToJobName(requestId)
            val namespace = k8.nameAllocator.jobIdToNamespace(requestId)
            val pullSent = ArrayList<String>()

            val events = k8.client.watchResource<WatchEvent<Event>>(
                this,
                KubernetesResources.events.withNamespace(namespace),
                mapOf("fieldSelector" to "involvedObject.fieldPath=spec.containers{${USER_JOB_CONTAINER}}")
            )

            val logListeners = HashMap<String, ByteReadChannel>()
            val readBuffer = ByteArray(1024 * 32)
            var nextCheck = 0L

            loop@ while (isActive) {
                if (Time.now() > nextCheck) {
                    val pods = k8.client.listResources<Pod>(
                        KubernetesResources.pod.withNamespace(namespace),
                        mapOf("labelSelector" to "$VOLCANO_JOB_NAME_LABEL=$jobName")
                    )

                    val activePodSet = pods.mapNotNull { pod ->
                        if (pod.status?.containerStatuses?.all { it.ready == true } != true) return@mapNotNull null
                        pod.metadata?.name
                    }.toSet()

                    val knownPods = logListeners.keys
                    val newPods = activePodSet - knownPods
                    val deletedPods = knownPods - activePodSet
                    deletedPods.forEach { p ->
                        logListeners.remove(p)?.cancel()
                    }
                    newPods.forEach { p ->
                        val receive = runCatching {
                            k8.client.sendRequest<HttpStatement>(
                                HttpMethod.Get,
                                KubernetesResources.pod.withNameAndNamespace(p, namespace),
                                mapOf("follow" to "true", "container" to USER_JOB_CONTAINER),
                                "log"
                            ).receive<ByteReadChannel>()
                        }.getOrNull()

                        if (receive != null) {
                            logListeners[p] = receive
                        }
                    }

                    if (knownPods.isEmpty()) {
                        // Check often while there are no pods
                        nextCheck = Time.now() + 5_00
                    } else {
                        // Check less often while we have some pods
                        // TODO Ideally this would not trigger before all pods are ready
                        nextCheck = Time.now() + 60_000
                    }
                    continue@loop
                }

                val logIterator = logListeners.iterator()
                while (logIterator.hasNext()) {
                    val (podName, listener) = logIterator.next()
                    val rank = k8.nameAllocator.rankFromPodName(podName)
                    if (rank == 0) {
                        if (listener.availableForRead > 0) {
                            val read = listener.readAvailable(readBuffer)
                            if (read > 0) {
                                send(String(readBuffer, 0, read, Charsets.UTF_8))
                            } else if (read < 0) {
                                runCatching { listener.cancel() }
                                logIterator.remove()
                            }
                        }
                    }
                    continue@loop
                }

                val ev = events.poll()
                if (ev != null) {
                    val message = ev.theObject.message ?: continue@loop
                    val involvedObject = ev.theObject.involvedObject ?: continue@loop
                    if (involvedObject.kind != "Pod") continue@loop
                    val name = involvedObject.name
                    if (name == null || name.startsWith(jobName)) continue@loop
                    val rank = name.substringAfterLast("-")
                    val prefix = "[UCloud/K8s (Job rank: $rank)] "

                    if (ev.theObject.reason == "Pulling") {
                        if (!pullSent.contains(rank)) {
                            send(prefix + message + "\n")
                            pullSent.add(rank)
                            launch {
                                val estimatedSize = try {
                                    k8.dockerImageSizeQuery.estimateSize(
                                        message.removePrefix("Pulling image").trim().removeSurrounding("\"")
                                    )
                                } catch (ex: Throwable) {
                                    log.debug(ex.stackTraceToString())
                                    null
                                }

                                runCatching {
                                    if (estimatedSize != null) {
                                        send(prefix + "Image size: ${bytesToString(estimatedSize)}\n")
                                    }
                                }
                            }
                        }
                    }

                    if (ev.theObject.reason == "Failed") {
                        when {
                            message.contains("not registered") -> {
                                // Ignore
                            }

                            else -> {
                                send(prefix + message + "\n")
                            }
                        }
                    }
                }
            }
        }
    }

    @Suppress("BlockingMethodInNonBlockingContext")
    suspend fun downloadLogsToDirectory(jobId: String): File? {
        val directory = Files.createTempDirectory("logs").toFile()
        val jobName = k8.nameAllocator.jobIdToJobName(jobId)
        val namespace = k8.nameAllocator.jobIdToNamespace(jobId)

        val pods = try {
            k8.client.listResources<Pod>(
                KubernetesResources.pod.withNamespace(namespace),
                mapOf("labelSelector" to "$VOLCANO_JOB_NAME_LABEL=$jobName")
            )
        } catch (ex: KubernetesException) {
            if (ex.statusCode.value in setOf(400, 404)) {
                return null
            }
            throw ex
        }

        pods.forEach { p ->
            val podName = p.metadata?.name ?: return@forEach
            val channel = runCatching {
                k8.client.sendRequest<HttpStatement>(
                    HttpMethod.Get,
                    KubernetesResources.pod.withNameAndNamespace(podName, namespace),
                    mapOf("container" to USER_JOB_CONTAINER),
                    "log"
                ).receive<ByteReadChannel>()
            }.getOrNull() ?: return@forEach

            val rank = k8.nameAllocator.rankFromPodName(podName)

            val fileName = if (rank == 0) {
                "stdout.txt"
            } else {
                "stdout-$rank.txt"
            }

            FileOutputStream(File(directory, fileName)).use { fos ->
                channel.copyTo(fos)
            }
        }

        return directory
    }

    companion object : Loggable {
        override val log = logger()
    }
}