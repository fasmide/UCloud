package dk.sdu.cloud.file.orchestrator

import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.accounting.util.*
import dk.sdu.cloud.auth.api.authenticator
import dk.sdu.cloud.calls.client.OutgoingHttpCall
import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.calls.client.orThrow
import dk.sdu.cloud.file.orchestrator.api.*
import dk.sdu.cloud.file.orchestrator.rpc.*
import dk.sdu.cloud.file.orchestrator.service.*
import dk.sdu.cloud.micro.Micro
import dk.sdu.cloud.micro.backgroundScope
import dk.sdu.cloud.micro.redisConnectionManager
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.async.AsyncDBSessionFactory

class Server(override val micro: Micro) : CommonServer {
    override val log = logger()

    override fun start() {
        val db = AsyncDBSessionFactory(micro)
        val serviceClient = micro.authenticator.authenticateClient(OutgoingHttpCall)
        val providers = StorageProviders(serviceClient) { comms ->
            StorageCommunication(
                comms.client,
                comms.wsClient,
                comms.provider,
                FilesProvider(comms.provider.id),
                FileCollectionsProvider(comms.provider.id)
            )
        }
        val providerSupport = StorageProviderSupport(providers, serviceClient) { comms ->
            comms.fileCollectionsApi.retrieveProducts.call(Unit, comms.client).orThrow().responses
        }
        val templateSupport = ProviderSupport<StorageCommunication, Product, FileMetadataTemplateSupport>(
            providers, serviceClient, fetchSupport = { listOf(FileMetadataTemplateSupport()) })
        val projectCache = ProjectCache(DistributedStateFactory(micro), db)
        val metadataTemplateNamespaces = MetadataTemplateNamespaces(projectCache, db, providers, templateSupport, serviceClient)
        val fileCollections = FileCollectionService(projectCache, db, providers, providerSupport, serviceClient)
        val metadataService = MetadataService(db, fileCollections, metadataTemplateNamespaces)
        val filesService = FilesService(
            fileCollections,
            providers,
            providerSupport,
            metadataService,
            metadataTemplateNamespaces,
            serviceClient,
            db
        )

        val shares = ShareService(
            projectCache,
            db,
            providers,
            ProviderSupport(providers, serviceClient) { comms ->
                SharesProvider(comms.provider.id).retrieveProducts.call(Unit, comms.client).orThrow().responses
            },
            serviceClient,
            filesService,
            fileCollections
        )

        val syncProviders = Providers(serviceClient) { SimpleProviderCommunication(it.client, it.wsClient, it.provider) }
        val syncSupport = ProviderSupport<SimpleProviderCommunication, Product.Synchronization, SyncDeviceSupport>(
            syncProviders,
            serviceClient,
        ) { comms ->
            SyncFolderProvider(comms.provider.id).retrieveProducts.call(Unit, comms.client).orThrow().responses
        }
        val syncDeviceService = SyncDeviceService(projectCache, db, syncProviders, syncSupport, serviceClient)
        val syncFolderService = SyncFolderService(projectCache, db, syncProviders, syncSupport, serviceClient,
            filesService, fileCollections, DistributedLockFactory(micro), micro.backgroundScope)

        filesService.addMoveHandler(metadataService::onFilesMoved)
        filesService.addDeleteHandler(metadataService::onFilesDeleted)
        syncFolderService.initialize()

        configureControllers(
            FileMetadataController(metadataService),
            FileController(filesService),
            FileCollectionController(fileCollections),
            FileMetadataTemplateController(metadataTemplateNamespaces),
            ShareController(shares),
            syncDeviceService.asController(),
            syncFolderService.asController()
        )

        startServices()
    }
}
