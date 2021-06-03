package dk.sdu.cloud.file.orchestrator.service

import dk.sdu.cloud.*
import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.accounting.util.ProductRefOrResource
import dk.sdu.cloud.accounting.util.ResourceService
import dk.sdu.cloud.calls.*
import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.calls.client.orThrow
import dk.sdu.cloud.file.orchestrator.api.*
import dk.sdu.cloud.provider.api.Permission
import dk.sdu.cloud.provider.api.ResourceUpdate
import dk.sdu.cloud.provider.api.UpdatedAcl
import dk.sdu.cloud.service.db.async.*
import io.ktor.http.*
import kotlinx.serialization.KSerializer

/*
class FileCollectionService(
    private val providers: StorageProviders,
    private val providerSupport: StorageProviderSupport,
    private val projectCache: ProjectCache,
    private val db: AsyncDBSessionFactory,
) : ResourceService<
    FileCollection,
    FileCollection.Spec,
    FileCollectionIncludeFlags,
    StorageCommunication,
    FSSupport,
    FileCollection.Update,
    Product.Storage>(db, providers, providerSupport) {
    override val serializer: KSerializer<FileCollection> = FileCollection.serializer()
    override val sortColumn: String = "title"
    override val table: String = "file_orchestrator.file_collections"

    override val updateSerializer: KSerializer<FileCollection.Update>
        get() = TODO("Not yet implemented")

    override val resourceType: String
        get() = super.resourceType

    override val sqlJsonConverter: String
        get() = super.sqlJsonConverter

    override fun endpointForCreate(comms: StorageCommunication): CallDescription<BulkRequest<FileCollection.Spec>, BulkResponse<FindByStringId?>, CommonErrorMessage> {
        TODO("Not yet implemented")
    }

    override fun verifyProviderSupportsCreate(
        spec: FileCollection.Spec,
        res: ProductRefOrResource<FileCollection>,
        support: FSSupport
    ) {
        TODO("Not yet implemented")
    }

    override suspend fun createSpecification(
        resourceId: Long,
        specification: FileCollection.Spec,
        session: AsyncDBConnection
    ) {
        TODO("Not yet implemented")
    }

    override fun endpointForUpdateAcl(comms: StorageCommunication): CallDescription<BulkRequest<UpdatedAcl>, BulkResponse<Unit?>, CommonErrorMessage> {
        TODO("Not yet implemented")
    }

    override fun verifyProviderSupportsUpdateAcl(
        spec: UpdatedAcl,
        res: ProductRefOrResource<FileCollection>,
        support: FSSupport
    ) {
        TODO("Not yet implemented")
    }

    override fun endpointForDelete(comms: StorageCommunication): CallDescription<BulkRequest<FindByStringId>, BulkResponse<Unit?>, CommonErrorMessage> {
        TODO("Not yet implemented")
    }

    override fun verifyProviderSupportsDelete(
        id: FindByStringId,
        res: ProductRefOrResource<FileCollection>,
        support: FSSupport
    ) {
        TODO("Not yet implemented")
    }

    /*
    suspend fun retrieveManifest(
        request: FileCollectionsRetrieveManifestRequest,
    ): FileCollectionsRetrieveManifestResponse {
        val comms = providers.prepareCommunication(request.provider)
        return comms.fileCollectionsApi.retrieveManifest.call(Unit, comms.client).orThrow()
    }

    suspend fun create(
        actorAndProject: ActorAndProject,
        request: FileCollectionsCreateRequest,
    ): BulkResponse<FindByStringId> {
        val requestsByProvider = HashMap<String, List<Pair<Int, FileCollection.Spec>>>()
        for ((index, reqItem) in request.items.withIndex()) {
            requestsByProvider[reqItem.product.provider] =
                (requestsByProvider[reqItem.product.provider] ?: emptyList()) + Pair(index, reqItem)
        }
        val allIds = arrayOfNulls<FindByStringId?>(request.items.size)
        for ((provider, requests) in requestsByProvider) {
            val comms = providers.prepareCommunication(provider)
            val ids = comms.fileCollectionsApi.create.call(
                proxiedRequest(projectCache, actorAndProject, bulkRequestOf(requests.map { it.second })),
                comms.client,
            ).orThrow().responses
            for ((index, id) in ids.withIndex()) {
                allIds[requestsByProvider[provider]!![index].first] = id
            }
        }
        return BulkResponse(allIds.filterNotNull())
    }

    suspend fun rename(
        actorAndProject: ActorAndProject,
        request: FileCollectionsRenameRequest,
    ) {
        retrieveBulk(
            actorAndProject,
            request.items.map { it.id },
            FileCollectionIncludeFlags(),
            Permission.Edit
        )
        val requestsByProvider = request.items.groupBy { it.provider }
        for ((provider, requests) in requestsByProvider) {
            val comms = providers.prepareCommunication(provider)
            comms.fileCollectionsApi.rename.call(
                proxiedRequest(
                    projectCache,
                    actorAndProject,
                    bulkRequestOf(requests.map { FileCollectionsProviderRenameRequestItem(it.id, it.newTitle) })
                ),
                comms.client
            ).orThrow()
        }
    }

    suspend fun delete(
        actorAndProject: ActorAndProject,
        request: FileCollectionsDeleteRequest,
    ) {
        val requestsByProvider = request.items.groupBy { it.provider }
        for ((provider, requests) in requestsByProvider) {
            val comms = providers.prepareCommunication(provider)
            comms.fileCollectionsApi.delete.call(
                proxiedRequest(
                    projectCache,
                    actorAndProject,
                    bulkRequestOf(requests.map { FindByStringId(it.id) })
                ),
                comms.client
            ).orThrow()
        }
    }

    suspend fun updateAcl(
        actorAndProject: ActorAndProject,
        request: FileCollectionsUpdateAclRequest,
    ) {
        val requestsByProvider = request.items.groupBy { it.provider }
        for ((provider, requests) in requestsByProvider) {
            val comms = providers.prepareCommunication(provider)
            comms.fileCollectionsApi.updateAcl.call(
                proxiedRequest(
                    projectCache,
                    actorAndProject,
                    bulkRequestOf(requests.map { FileCollectionsProviderUpdateAclRequestItem(it.id, it.newAcl) })
                ),
                comms.client
            ).orThrow()
        }
    }
     */
}

 */
