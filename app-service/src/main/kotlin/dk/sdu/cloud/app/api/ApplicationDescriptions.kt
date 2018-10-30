package dk.sdu.cloud.app.api

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import dk.sdu.cloud.AccessRight
import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.Roles
import dk.sdu.cloud.client.RESTDescriptions
import dk.sdu.cloud.service.KafkaRequest
import dk.sdu.cloud.service.Page
import dk.sdu.cloud.service.PaginationRequest
import dk.sdu.cloud.service.WithPaginationRequest
import io.ktor.http.HttpMethod

data class FindApplicationAndOptionalDependencies(
    val name: String,
    val version: String
)

data class FavoriteRequest(
    val name: String,
    val version: String
)

data class TagSearchRequest(
    val query: String,
    override val itemsPerPage: Int?,
    override val page: Int?
) : WithPaginationRequest

data class AppSearchRequest(
    val query: String,
    override val itemsPerPage: Int?,
    override val page: Int?
) : WithPaginationRequest

@Deprecated("Replaced with ApplicationDescriptions", ReplaceWith("ApplicationDescriptions"))
typealias HPCApplicationDescriptions = ApplicationDescriptions

object ApplicationDescriptions : RESTDescriptions("hpc.apps") {
    const val baseContext = "/api/hpc/apps/"

    val toggleFavorite = callDescription<FavoriteRequest, Unit, CommonErrorMessage> {
        name = "toggleFavorite"
        method = HttpMethod.Post

        auth {
            access = AccessRight.READ_WRITE
        }

        path {
            using(baseContext)
            +"favorites"
            +boundTo(FavoriteRequest::name)
            +boundTo(FavoriteRequest::version)
        }
    }

    val retrieveFavorites = callDescription<PaginationRequest, Page<ApplicationForUser>, CommonErrorMessage> {
        name = "retrieveFavorites"
        method = HttpMethod.Get

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +"favorites"
        }

        params {
            +boundTo(PaginationRequest::itemsPerPage)
            +boundTo(PaginationRequest::page)
        }
    }
    val searchTags = callDescription<TagSearchRequest, Page<ApplicationForUser>, CommonErrorMessage> {
        name = "searchTags"
        method = HttpMethod.Get

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +"searchTags"
        }

        params {
            +boundTo(TagSearchRequest::query)
            +boundTo(TagSearchRequest::itemsPerPage)
            +boundTo(TagSearchRequest::page)
        }
    }

    val searchApps = callDescription<AppSearchRequest, Page<ApplicationForUser>, CommonErrorMessage> {
        name = "searchApps"
        method = HttpMethod.Get

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +"search"
        }

        params {
            +boundTo(AppSearchRequest::query)
            +boundTo(AppSearchRequest::itemsPerPage)
            +boundTo(AppSearchRequest::page)
        }
    }

    val findByName = callDescription<FindByNameAndPagination, Page<Application>, CommonErrorMessage> {
        name = "findByName"

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +boundTo(FindByNameAndPagination::name)
        }

        params {
            +boundTo(FindByNameAndPagination::itemsPerPage)
            +boundTo(FindByNameAndPagination::page)
        }
    }

    val findByNameAndVersion = callDescription<
            FindApplicationAndOptionalDependencies,
            Application,
            CommonErrorMessage> {
        name = "appsFindByNameAndVersion"

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +boundTo(FindApplicationAndOptionalDependencies::name)
            +boundTo(FindApplicationAndOptionalDependencies::version)
        }
    }

    val listAll = callDescription<PaginationRequest, Page<ApplicationForUser>, CommonErrorMessage> {
        name = "listAll"
        path { using(baseContext) }

        auth {
            access = AccessRight.READ
        }

        params {
            +boundTo(PaginationRequest::itemsPerPage)
            +boundTo(PaginationRequest::page)
        }
    }

    val create = callDescription<Unit, Unit, CommonErrorMessage> {
        name = "create"
        method = HttpMethod.Put

        auth {
            roles = Roles.PRIVILEDGED
            access = AccessRight.READ
        }

        path { using(baseContext) }
        // body { //YAML Body TODO Implement support }
    }
}

@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = KafkaRequest.TYPE_PROPERTY
)
@JsonSubTypes(
    JsonSubTypes.Type(value = AppRequest.Start::class, name = "start")
)
sealed class AppRequest {
    data class Start(
        val application: NameAndVersion,
        val parameters: Map<String, Any>,
        val numberOfNodes: Int? = null,
        val tasksPerNode: Int? = null,
        val maxTime: SimpleDuration? = null,
        val backend: String? = null
    ) : AppRequest()
}