package dk.sdu.cloud.app.kubernetes.api

import dk.sdu.cloud.*
import dk.sdu.cloud.accounting.api.ProductCategoryId
import dk.sdu.cloud.app.orchestrator.api.LicenseProvider
import dk.sdu.cloud.calls.*
import kotlinx.serialization.Serializable

@Serializable
data class KubernetesLicense(
    val id: String,
    val address: String,
    val port: Int,
    val tags: List<String> = emptyList(),
    val license: String? = null,
    val category: ProductCategoryId,
    val pricePerUnit: Long = 1_000_000,
    val description: String = "",
    val hiddenInGrantApplications: Boolean = false,
    val priority: Int = 0,
)

interface KubernetesLicenseFilter {
    val tag: String?
}

typealias KubernetesLicenseCreateRequest = BulkRequest<KubernetesLicense>
typealias KubernetesLicenseCreateResponse = Unit

@Serializable
data class KubernetesLicenseBrowseRequest(
    override val tag: String? = null,
    override val itemsPerPage: Int? = null,
    override val next: String? = null,
    override val consistency: PaginationRequestV2Consistency? = null,
    override val itemsToSkip: Long? = null
) : WithPaginationRequestV2, KubernetesLicenseFilter
typealias KubernetesLicenseBrowseResponse = PageV2<KubernetesLicense>

typealias KubernetesLicenseDeleteRequest = BulkRequest<FindByStringId>
typealias KubernetesLicenseDeleteResponse = Unit

typealias KubernetesLicenseUpdateRequest = BulkRequest<KubernetesLicense>
typealias KubernetesLicenseUpdateResponse = Unit

@TSNamespace("compute.ucloud.licenses.maintenance")
class KubernetesLicenseMaintenance(providerId: String) : CallDescriptionContainer("compute.licenses.ucloud.maintenance") {
    val baseContext = LicenseProvider(providerId).baseContext + "/maintenance"

    init {
        title = "Licenses"
        description = """
            Licenses are needed for applications where the software require a license to run e.g MatLab, Comsol etc..
            The users need to acquire the license themselves outside of UCloud. If the license is a floating license, 
            the license can be integrated into UCLoud using the License Product. 
            When creating a license the user needs to specify the address to where this license can be found and a port 
            to listen to.
            Currently these licenses can only be created in UCloud by ADMINs. Once the license has been created the 
            given project, who owns the license, will be given an allocation in their wallet. They will need to uses this 
            allocation to share the license to their respective peers. Usually a license is bought by a university or 
            faculty and all projects that apply to the main project of the given university/faculty will also be able to
            apply for the license.
        """.trimIndent()
    }

    val create = call<KubernetesLicenseCreateRequest, KubernetesLicenseCreateResponse, CommonErrorMessage>("create") {
        httpCreate(baseContext, roles = Roles.ADMIN)
    }

    val browse = call<KubernetesLicenseBrowseRequest, KubernetesLicenseBrowseResponse, CommonErrorMessage>("browse") {
        httpBrowse(baseContext, roles = Roles.ADMIN)
    }

    val update = call<KubernetesLicenseUpdateRequest, KubernetesLicenseUpdateResponse, CommonErrorMessage>("update") {
        httpUpdate(baseContext, "update", roles = Roles.ADMIN)
    }
}
