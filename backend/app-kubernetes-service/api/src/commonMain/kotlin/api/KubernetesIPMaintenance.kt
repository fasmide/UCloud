package dk.sdu.cloud.app.kubernetes.api

import dk.sdu.cloud.*
import dk.sdu.cloud.app.orchestrator.api.NetworkIPProvider
import dk.sdu.cloud.calls.*
import kotlinx.serialization.Serializable

@Serializable
data class K8NetworkStatus(val capacity: Long, val used: Long)

@Serializable
data class K8Subnet(val externalCidr: String, val internalCidr: String)

typealias KubernetesIPMaintenanceCreateRequest = BulkRequest<K8Subnet>
typealias KubernetesIPMaintenanceCreateResponse = Unit

@Serializable
data class KubernetesIPMaintenanceBrowseRequest(
    override val itemsPerPage: Int? = null,
    override val next: String? = null,
    override val consistency: PaginationRequestV2Consistency? = null,
    override val itemsToSkip: Long? = null,
) : WithPaginationRequestV2
typealias KubernetesIPMaintenanceBrowseResponse = PageV2<K8Subnet>

typealias KubernetesIPMaintenanceRetrieveStatusRequest = Unit
typealias KubernetesIPMaintenanceRetrieveStatusResponse = K8NetworkStatus

@TSNamespace("compute.ucloud.networkip.maintenance")
class KubernetesNetworkIPMaintenance(providerId: String) : CallDescriptionContainer("compute.networkip.ucloud.maintenance") {
    val baseContext = NetworkIPProvider(providerId).baseContext + "/maintenance"

    init {
        title = "NetworkIps / Public IP"
        description = """
            Public IPs are attached to applications to enable access by external third-party applications.
            UCloud only supports a limited range of IPs for this feature, since we need to allocate
            the IPs up front. 
        """.trimIndent()
    }

    val create = call<KubernetesIPMaintenanceCreateRequest, KubernetesIPMaintenanceCreateResponse,
        CommonErrorMessage>("create") {
        httpCreate(baseContext, roles = Roles.PRIVILEGED)
    }

    val browse = call<KubernetesIPMaintenanceBrowseRequest, KubernetesIPMaintenanceBrowseResponse,
        CommonErrorMessage>("browse") {
        httpBrowse(baseContext, roles = Roles.PRIVILEGED)
    }

    val retrieveStatus = call<KubernetesIPMaintenanceRetrieveStatusRequest,
        KubernetesIPMaintenanceRetrieveStatusResponse, CommonErrorMessage>("retrieveStatus") {
        httpRetrieve(baseContext, roles = Roles.PRIVILEGED)
    }
}
