package dk.sdu.cloud.app.orchestrator.api

import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.FindByStringId
import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.accounting.api.ProductReference
import dk.sdu.cloud.accounting.api.providers.ProductSupport
import dk.sdu.cloud.accounting.api.providers.ResolvedSupport
import dk.sdu.cloud.accounting.api.providers.ResourceApi
import dk.sdu.cloud.accounting.api.providers.ResourceTypeInfo
import dk.sdu.cloud.calls.*
import dk.sdu.cloud.provider.api.*
import io.ktor.http.*
import kotlinx.serialization.Contextual
import kotlinx.serialization.Serializable

@Serializable
data class IngressSettings(
    val domainPrefix: String,
    val domainSuffix: String,
    override val product: ProductReference,
) : ProductSupport

@Serializable
data class IngressSpecification(
    @UCloudApiDoc("The domain used for L7 load-balancing for use with this `Ingress`")
    val domain: String,

    @UCloudApiDoc("The product used for the `Ingress`")
    override val product: ProductReference
) : ResourceSpecification {
    init {
        if (domain.length > 2000) {
            throw RPCException("domain size cannot exceed 2000 characters", HttpStatusCode.BadRequest)
        }
    }
}

@UCloudApiExperimental(ExperimentalLevel.ALPHA)
@UCloudApiDoc("An L7 ingress-point (HTTP)")
@Serializable
data class Ingress(
    override val id: String,

    override val specification: IngressSpecification,

    @UCloudApiDoc("Information about the owner of this resource")
    override val owner: ResourceOwner,

    @UCloudApiDoc("Information about when this resource was created")
    override val createdAt: Long,

    @UCloudApiDoc("The current status of this resource")
    override val status: IngressStatus,

    @UCloudApiDoc("A list of updates for this `Ingress`")
    override val updates: List<IngressUpdate> = emptyList(),

    override val permissions: ResourcePermissions? = null,
) : Resource<Nothing?> {
    override val billing = ResourceBilling.Free
    override val acl: List<ResourceAclEntry<@Contextual Nothing?>>? = null
}

@UCloudApiDoc("The status of an `Ingress`")
@Serializable
data class IngressStatus(
    @UCloudApiDoc("The ID of the `Job` that this `Ingress` is currently bound to")
    val boundTo: String? = null,

    val state: IngressState,
    override var support: ResolvedSupport<*, *>? = null
) : ResourceStatus

@UCloudApiExperimental(ExperimentalLevel.ALPHA)
@Serializable
enum class IngressState {
    @UCloudApiDoc(
        "A state indicating that the `Ingress` is currently being prepared and is expected to reach `READY` soon."
    )
    PREPARING,

    @UCloudApiDoc("A state indicating that the `Ingress` is ready for use or already in use.")
    READY,

    @UCloudApiDoc(
        "A state indicating that the `Ingress` is currently unavailable.\n\n" +
            "This state can be used to indicate downtime or service interruptions by the provider."
    )
    UNAVAILABLE
}

@UCloudApiExperimental(ExperimentalLevel.ALPHA)
@Serializable
data class IngressUpdate(
    @UCloudApiDoc("The new state that the `Ingress` transitioned to (if any)")
    val state: IngressState? = null,

    @UCloudApiDoc("A new status message for the `Ingress` (if any)")
    override val status: String? = null,

    val didBind: Boolean = false,

    val newBinding: String? = null,

    @UCloudApiDoc("A timestamp for when this update was registered by UCloud")
    override val timestamp: Long = 0,
) : ResourceUpdate

interface IngressFilters {
    val domain: String?
    val provider: String?
}

@Serializable
data class IngressIncludeFlags(
    override val includeOthers: Boolean = false,
    override val includeUpdates: Boolean = false,
    override val includeSupport: Boolean = false,
) : ResourceIncludeFlags

@TSNamespace("compute.ingresses")
@UCloudApiExperimental(ExperimentalLevel.ALPHA)
object Ingresses : ResourceApi<
    Ingress,
    IngressSpecification,
    IngressUpdate,
    IngressIncludeFlags,
    IngressStatus,
    Product.Ingress,
    IngressSettings>("ingresses") {
    override val typeInfo = ResourceTypeInfo<Ingress, IngressSpecification, IngressUpdate,
        IngressIncludeFlags, IngressStatus, Product.Ingress, IngressSettings>()

    override val delete: CallDescription<BulkRequest<FindByStringId>, BulkResponse<Unit?>, CommonErrorMessage>
        get() = super.delete!!
}
