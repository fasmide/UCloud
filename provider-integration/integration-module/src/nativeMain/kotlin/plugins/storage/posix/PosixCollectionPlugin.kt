package dk.sdu.cloud.plugins.storage.posix

import dk.sdu.cloud.ProductReferenceWithoutProvider
import dk.sdu.cloud.ServerMode
import dk.sdu.cloud.accounting.api.*
import dk.sdu.cloud.accounting.api.providers.ResourceChargeCredits
import dk.sdu.cloud.calls.BulkRequest
import dk.sdu.cloud.calls.BulkResponse
import dk.sdu.cloud.calls.client.AuthenticatedClient
import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.calls.client.orThrow
import dk.sdu.cloud.config.*
import dk.sdu.cloud.controllers.ResourceOwnerWithId
import dk.sdu.cloud.file.orchestrator.api.*
import dk.sdu.cloud.plugins.*
import dk.sdu.cloud.plugins.storage.InternalFile
import dk.sdu.cloud.plugins.storage.PathConverter
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.Time
import kotlinx.cinterop.*
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import platform.linux.statvfs
import platform.posix.errno
import platform.posix.geteuid
import platform.posix.getpwuid

class PosixCollectionPlugin : FileCollectionPlugin {
    override var pluginName: String = "Unknown"
    override var productAllocation: List<ProductReferenceWithoutProvider> = emptyList()
    override var productAllocationResolved: List<Product> = emptyList()
    private lateinit var pluginConfig: PosixFileCollectionsConfiguration
    private var initializedProjects = HashMap<ResourceOwnerWithId, List<PathConverter.Collection>>()
    private val mutex = Mutex()

    override fun configure(config: ConfigSchema.Plugins.FileCollections) {
        this.pluginConfig = config as PosixFileCollectionsConfiguration
    }

    override suspend fun PluginContext.onAllocationComplete(notification: AllocationNotification) {
        locateAndRegisterCollections(notification.owner)
    }

    private suspend fun PluginContext.locateAndRegisterCollections(
        owner: ResourceOwnerWithId
    ): List<PathConverter.Collection> {
        val pathConverter = PathConverter(this)
        mutex.withLock {
            val cached = initializedProjects[owner]
            if (cached != null) return cached
        }

        data class CollWithProduct(
            val title: String,
            val pathPrefix: String,
            val product: ProductReferenceWithoutProvider
        )

        val homes = HashMap<String, CollWithProduct>()
        val collections = ArrayList<PathConverter.Collection>()

        run {
            val product = productAllocation.firstOrNull() ?: return@run

            run {
                // Simple mappers
                pluginConfig.simpleHomeMapper.forEach { home ->
                    homes[home.prefix] = CollWithProduct(home.title, home.prefix, product)
                }

                if (owner is ResourceOwnerWithId.User && homes.isNotEmpty()) {
                    val username = run {
                        val uid = geteuid()
                        getpwuid(uid)?.pointed?.pw_name?.toKStringFromUtf8() ?: "$uid"
                    }

                    homes.forEach { (_, coll) ->
                        val mappedPath = coll.pathPrefix.removeSuffix("/") + "/" + username
                        collections.add(
                            PathConverter.Collection(owner.toResourceOwner(), coll.title, mappedPath, coll.product)
                        )
                    }
                }
            }

            run {
                // Extensions
                val extension = pluginConfig.extensions.additionalCollections
                if (extension != null) {
                    retrieveCollections.invoke(extension, owner).forEach {
                        collections.add(
                            PathConverter.Collection(owner.toResourceOwner(), it.title, it.path, product)
                        )
                    }
                }
            }
        }

        mutex.withLock {
            val cached = initializedProjects[owner]
            if (cached != null) return cached
            initializedProjects[owner] = collections
        }

        if (collections.isNotEmpty()) {
            pathConverter.registerCollectionWithUCloud(collections)
        }

        return collections
    }

    override suspend fun PluginContext.retrieveProducts(
        knownProducts: List<ProductReference>
    ): BulkResponse<FSSupport> {
        return BulkResponse(productAllocation.map { ref ->
            FSSupport(
                ProductReference(ref.id, ref.category, config.core.providerId),
                FSProductStatsSupport(),
                FSCollectionSupport(),
                FSFileSupport()
            )
        })
    }

    private suspend fun ArrayList<ResourceChargeCredits>.sendBatch(client: AuthenticatedClient) {
        if (isEmpty()) return
        FileCollectionsControl.chargeCredits.call(BulkRequest(this), client).orThrow()
        clear()
    }

    private suspend fun ArrayList<ResourceChargeCredits>.addToBatch(
        client: AuthenticatedClient,
        item: ResourceChargeCredits
    ) {
        add(item)
        if (size >= 100) sendBatch(client)
    }

    override suspend fun PluginContext.runMonitoringLoop() {
        if (config.serverMode != ServerMode.Server) return
        if (pluginConfig.accounting == null) return

        val pathConverter = PathConverter(this)
        val productCategories = productAllocation.map { it.category }.toSet()

        var nextScan = 0L

        while (currentCoroutineContext().isActive) {
            try {
                val now = Time.now()
                if (now >= nextScan) {
                    val batchBuilder = ArrayList<ResourceChargeCredits>()

                    for (category in productCategories) {
                        var next: String? = null
                        while (currentCoroutineContext().isActive) {
                            val summary = Wallets.retrieveProviderSummary.call(
                                WalletsRetrieveProviderSummaryRequest(
                                    filterCategory = category,
                                    itemsPerPage = 250,
                                    next = next,
                                ),
                                rpcClient
                            ).orThrow()

                            for (item in summary.items) {
                                val resourceOwner = ResourceOwnerWithId.load(item.owner, this) ?: continue
                                val colls = locateAndRegisterCollections(resourceOwner)
                                    .filter { it.product.category == category }

                                if (colls.isNotEmpty()) {
                                    val bytesUsed = colls.sumOf { calculateUsage(it) }
                                    val unitsUsed = bytesUsed / 1_000_000_000L
                                    val coll = pathConverter.ucloudToCollection(
                                        pathConverter.internalToUCloud(InternalFile(colls.first().localPath))
                                    )

                                    batchBuilder.addToBatch(
                                        rpcClient,
                                        ResourceChargeCredits(
                                            coll.id,
                                            "$now-${coll.id}",
                                            unitsUsed
                                        )
                                    )
                                }
                            }

                            batchBuilder.sendBatch(rpcClient)

                            next = summary.next
                            if (next == null) break
                        }
                    }

                    nextScan = now + (1000L * 60 * 60 * 4)
                }

                delay(5000)
            } catch (ex: Throwable) {
                log.info("Caught exception while monitoring Posix collections: ${ex.stackTraceToString()}")
                nextScan = Time.now() + (1000L * 60 * 60 * 4)
            }
        }
    }

    private fun calculateUsage(coll: PathConverter.Collection): Long {
        return when (val cfg = pluginConfig.accounting) {
            "DeviceQuota" -> {
                memScoped {
                    val buf = alloc<statvfs>()
                    if (statvfs(coll.localPath, buf.ptr) != 0) {
                        error("statvfs failed $errno $coll")
                    }

                    val quota = buf.f_blocks * buf.f_frsize
                    val available = buf.f_favail * buf.f_bsize

                    // TODO(Dan): These numbers seem correct, but different from the numbers reported by df. Not
                    //  sure what is going on.
                    (quota - available).toLong()
                }
            }

            null -> 0

            else -> {
                calculateUsage.invoke(cfg, CalculateUsageRequest(coll.localPath)).bytesUsed
            }
        }
    }

    companion object : Loggable {
        override val log = logger()

        private val retrieveCollections = extension<ResourceOwnerWithId, List<PosixCollectionFromExtension>>()
        private val calculateUsage = extension<CalculateUsageRequest, CalculateUsageResponse>()
    }
}

@Serializable
data class CalculateUsageRequest(
    val path: String,
)

@Serializable
data class CalculateUsageResponse(
    val bytesUsed: Long,
)

@Serializable
private data class PosixCollectionFromExtension(
    val path: String,
    val title: String,
)
