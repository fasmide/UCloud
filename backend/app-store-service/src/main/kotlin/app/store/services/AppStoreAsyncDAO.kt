package dk.sdu.cloud.app.store.services

import app.store.services.canUserPerformWriteOperation
import app.store.services.findOwnerOfApplication
import app.store.services.internalByNameAndVersion
import app.store.services.internalFindAllByName
import app.store.services.internalHasPermission
import com.fasterxml.jackson.module.kotlin.readValue
import com.fasterxml.jackson.module.kotlin.readValues
import com.github.jasync.sql.db.RowData
import dk.sdu.cloud.Role
import dk.sdu.cloud.Roles
import dk.sdu.cloud.SecurityPrincipal
import dk.sdu.cloud.app.store.api.*
import dk.sdu.cloud.app.store.services.ApplicationTable.application
import dk.sdu.cloud.app.store.services.acl.*
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.defaultMapper
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.*
import dk.sdu.cloud.service.db.async.DBContext
import dk.sdu.cloud.service.db.async.getField
import dk.sdu.cloud.service.db.async.insert
import dk.sdu.cloud.service.db.async.sendPreparedStatement
import dk.sdu.cloud.service.db.async.withSession
import io.ktor.http.HttpStatusCode
import org.hibernate.query.Query
import org.joda.time.DateTimeZone
import org.joda.time.LocalDateTime
import java.util.*

@Suppress("TooManyFunctions") // Does not make sense to split
class AppStoreAsyncDAO(
    private val toolDAO: ToolHibernateDAO,
    private val aclDAO: AclHibernateDao
) : ApplicationDAO {
    private val byNameAndVersionCache = Collections.synchronizedMap(HashMap<NameAndVersion, Pair<Application, Long>>())

    private suspend fun findAppNamesFromTags(
        ctx: DBContext,
        user: SecurityPrincipal,
        project: String?,
        memberGroups: List<String>,
        tags: List<String>
    ): List<String> {
        return ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("user", user.username)
                    setParameter("project", project)
                    setParameter("groups", memberGroups)
                    setParameter("tags", tags)
                    setParameter("role", user.role.toString())
                    setParameter("privileged", Roles.PRIVILEDGED.toList())
                },
                """
                SELECT T.application_name, T.tag, T.id FROM application_tags AS T, applications AS A
                WHERE T.application_name = A.name AND T.tag IN (:tags) AND (
                    (
                        A.is_public = TRUE
                    ) OR (
                        cast(:project as text) is null AND ?user IN (
                            SELECT P1.username FROM permissions AS P1 WHERE P1.application_name = A.name
                        )
                    ) OR (
                        cast(:project as text) IS not null AND exists (
                            SELECT P2.project_group FROM permissions AS P2 WHERE
                                P2.application_name = A.name AND
                                P2.project = cast(?project as text) AND
                                P2.project_group IN (?groups)
                        )
                    ) or (
                        ?role in (?privileged)
                    )
                ) 
                """.trimIndent()
            ).rows.toList()
                .distinctBy { it.getField(TagTable.applicationName) }
                .map { it.getField(TagTable.applicationName) }
        }
    }

    private suspend fun findAppsFromAppNames(
        ctx: DBContext,
        user: SecurityPrincipal,
        project: String?,
        memberGroups: List<String>,
        applicationNames: List<String>
    ): Pair<List<RowData>, Int> {
        val items = ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("applications", applicationNames)
                    setParameter("user", user.username)
                    setParameter("project", project)
                    setParameter("groups", memberGroups)
                    setParameter("role", user.role.toString())
                    setParameter("privileged", Roles.PRIVILEDGED.toList())
                },
                """
                SELECT A.*
                FROM applications as A
                WHERE (A.created_at) IN (
                    SELECT MAX(B.created_at)
                    FROM applications as B
                    WHERE (A.title = B.title)
                    GROUP BY title
                ) AND (A.name) IN (?applications) AND (
                    (
                        A.is_public = TRUE
                    ) or (
                        cast(?project as text) is null and ?user in (
                            SELECT P1.username FROM permissions AS P1 WHERE P1.application_name = A.name
                        )
                    ) or (
                        cast(?project as text) is not null AND exists (
                            SELECT P2.project_group FROM permissions AS P2 WHERE
                                P2.application_name = A.name and
                                P2.project = cast(?project as text) and
                                P2.project_group in (?groups)
                        )
                    ) or (
                        ?role in (?privileged)
                    ) 
                )
                """.trimIndent()
            ).rows.toList()

        }

        return Pair(
            items, items.size
        )
    }

    suspend fun getAllApps(ctx: DBContext, user: SecurityPrincipal): List<RowData> {
        return ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("query", "")
                    setParameter("role", user.role.toString())
                    setParameter("privileged", Roles.PRIVILEDGED.toList())
                    setParameter("user", user.username)
                },
                """
                    SELECT *
                    FROM applications as A
                    WHERE LOWER(title) like '%' || ?query || '%' AND
                    (isPublic = TRUE or ?user in (
                        SELECT P.username FROM permissions AS P WHERE P.application_name = A.name
                    ) OR ?role in (?privileged)
                    ORDER BY A.title
                """.trimIndent()
            ).rows.toList()
        }
    }

    override suspend fun findAllByName(
        ctx: DBContext,
        user: SecurityPrincipal?,
        currentProject: String?,
        projectGroups: List<String>,
        appName: String,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        return ctx.withSession { session ->
            internalFindAllByName(
                session,
                user,
                currentProject,
                projectGroups,
                appName,
                paging
            ).mapItems { it.withoutInvocation() }
        }
    }

    override suspend fun findByNameAndVersion(
        ctx: DBContext,
        user: SecurityPrincipal?,
        currentProject: String?,
        projectGroups: List<String>,
        appName: String,
        appVersion: String
    ): Application {
        val cacheKey = NameAndVersion(appName, appVersion)
        val (cached, expiry) = byNameAndVersionCache[cacheKey] ?: Pair(null, 0L)
        if (cached != null && expiry > System.currentTimeMillis()) {
            if (ctx.withSession { session ->
                    internalHasPermission(
                        session,
                        user!!,
                        currentProject,
                        projectGroups,
                        cached.metadata.name,
                        cached.metadata.version,
                        ApplicationAccessRight.LAUNCH
                    )
                }
            ) {
                return cached
            }
        }

        val result = ctx.withSession { session -> internalByNameAndVersion(session, appName, appVersion)}
            ?.toApplicationWithInvocation() ?: throw ApplicationException.NotFound()

        if (ctx.withSession { session ->
                internalHasPermission(
                    session,
                    user!!,
                    currentProject,
                    projectGroups,
                    result.metadata.name,
                    result.metadata.version,
                    ApplicationAccessRight.LAUNCH
                )
            }
        ) {
            byNameAndVersionCache[cacheKey] = Pair(result, System.currentTimeMillis() + (1000L * 60 * 60))
            return result
        } else {
            throw ApplicationException.NotFound()
        }
    }

    override suspend fun findBySupportedFileExtension(
        ctx: DBContext,
        user: SecurityPrincipal,
        currentProject: String?,
        projectGroups: List<String>,
        fileExtensions: Set<String>
    ): List<ApplicationWithExtension> {
        var query = ""
        query += """
            SELECT A.*
            FROM favorited_by as F,
                applications as A
            WHERE F.the_user = ?user
              AND F.application_name = A.name
              AND F.application_version = A.version
              AND (A.application -> 'applicationType' = '"WEB"'
                OR A.application -> 'applicationType' = '"VNC"'
              ) and (
        """

        for (index in fileExtensions.indices) {
            query += """ A.application -> 'fileExtensions' @> jsonb_build_array(:ext$index) """
            if (index != fileExtensions.size - 1) {
                query += "OR "
            }
        }

        query += """
              )
        """

        return ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("user", user.username)
                    fileExtensions.forEachIndexed { index, ext ->
                        setParameter("ext$index", ext)
                    }
                },
                query
            ).rows.toList()
                .filter { rowData ->
                    defaultMapper.readValue<ApplicationInvocationDescription>(rowData.getField(ApplicationTable.application)).parameters.all {
                        it.optional
                    }
                }
                .map {
                    ApplicationWithExtension(
                        it.toApplicationMetadata(),
                        defaultMapper.readValue<ApplicationInvocationDescription>(it.getField(ApplicationTable.application)).fileExtensions
                    )
                }
        }
    }

    override suspend fun findByNameAndVersionForUser(
        ctx: DBContext,
        user: SecurityPrincipal,
        currentProject: String?,
        projectGroups: List<String>,
        appName: String,
        appVersion: String
    ): ApplicationWithFavoriteAndTags {
        if (!ctx.withSession { session ->
                internalHasPermission(
                    session,
                    user,
                    currentProject,
                    projectGroups,
                    appName,
                    appVersion,
                    ApplicationAccessRight.LAUNCH
                )
            }
        ) throw ApplicationException.NotFound()

        val entity = ctx.withSession { session ->
            internalByNameAndVersion(session, appName, appVersion)?.toApplicationWithInvocation()
        } ?: throw ApplicationException.NotFound()

        return ctx.withSession { session -> preparePageForUser(session, user.username, Page(1, 1, 0, listOf(entity))).items.first()}
    }

    override suspend fun listLatestVersion(
        ctx: DBContext,
        user: SecurityPrincipal?,
        currentProject: String?,
        projectGroups: List<String>,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        val groups = if (projectGroups.isEmpty()) {
            listOf("")
        } else {
            projectGroups
        }

        val userString = if (user != null) {
            if (user.username != null) {
                user.username
            } else {
                ""
            }
        } else {
            ""
        }

        val cleanRole = if (user != null) {
            if (user.role != null) {
                user.role
            } else {
                Role.UNKNOWN
            }
        } else {
            Role.UNKNOWN
        }

        val items = ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("role", cleanRole.toString())
                    setParameter("project", currentProject)
                    setParameter("groups", groups)
                    setParameter("privileged", Roles.PRIVILEDGED.toList())
                },
                """
                SELECT A.*
                FROM applications AS A WHERE (A.created_at) IN (
                    SELECT MAX(created_at)
                    FROM applications as B
                    WHERE A.name = B.name AND (
                        (
                            B.is_public = TRUE
                        ) or (
                            cast(?project as text) is null and ?user in (
                                SELECT P1.username FROM permissions AS P1 WHERE P1.application_name = B.name
                            )
                        ) or (
                            cast(:project as text) is not null AND exists (
                                SELECT P2.project_group FRO permissions AS P2 WHERE
                                    P2.application_name = B.name AND
                                    P2.project = cast(?project as text) AND
                                    P2.project_group IN (?groups)
                            )
                        ) or (
                            ?role IN (?privileged)
                        )
                    )
                    GROUP BY B.name
                )
                ORDER BY A.name
            """.trimIndent()
            ).rows.toList()
        }

        return ctx.withSession { session ->
            preparePageForUser(
                session,
                user?.username,
                Page(
                    items.size,
                    paging.itemsPerPage,
                    paging.page,
                    items.map { it.toApplicationWithInvocation() }
                )
            ).mapItems { it.withoutInvocation() }
        }
    }

    override suspend fun create(
        ctx: DBContext,
        user: SecurityPrincipal,
        description: Application,
        originalDocument: String
    ) {
        val existingOwner = ctx.withSession { session -> findOwnerOfApplication(session, description.metadata.name)}
        if (existingOwner != null && !canUserPerformWriteOperation(existingOwner, user)) {
            throw ApplicationException.NotAllowed()
        }

        val existing = ctx.withSession { session -> internalByNameAndVersion(session, description.metadata.name, description.metadata.version)}
        if (existing != null) throw ApplicationException.AlreadyExists()

        val existingTool = ctx.withSession { session -> toolDAO.internalByNameAndVersion(
            session,
            description.invocation.tool.name,
            description.invocation.tool.version
        )} ?: throw ApplicationException.BadToolReference()

        ctx.withSession { session ->
            session.insert(ApplicationTable) {
                set(ApplicationTable.owner, user.username)
                set(ApplicationTable.createdAt, LocalDateTime.now(DateTimeZone.UTC))
                set(ApplicationTable.modifiedAt, LocalDateTime.now(DateTimeZone.UTC))
                set(ApplicationTable.authors, defaultMapper.writeValueAsString(description.metadata.authors))
                set(ApplicationTable.title, description.metadata.title)
                set(ApplicationTable.description, description.metadata.description)
                set(ApplicationTable.website, description.metadata.website)
                set(ApplicationTable.toolName, existingTool.getField(ToolTable.idName))
                set(ApplicationTable.toolVersion, existingTool.getField(ToolTable.idVersion))
                set(ApplicationTable.isPublic, true)
                set(ApplicationTable.idName, description.metadata.name)
                set(ApplicationTable.idVersion, description.metadata.version)

            }
        }
    }

    override suspend fun delete(
        ctx: DBContext,
        user: SecurityPrincipal,
        project: String?,
        projectGroups: List<String>,
        appName: String,
        appVersion: String
    ) {
        val existingOwner = ctx.withSession { session -> findOwnerOfApplication(session, appName) }
        if (existingOwner != null && !canUserPerformWriteOperation(existingOwner, user)) {
            throw ApplicationException.NotAllowed()
        }

        // Prevent deletion of last version of application
        if (ctx.withSession { session ->
                internalFindAllByName(
                    session,
                    user,
                    project,
                    projectGroups,
                    appName,
                    paging = NormalizedPaginationRequest(25, 0)
                ).itemsInTotal <= 1
            }
        ) {
            throw ApplicationException.NotAllowed()
        }
        ctx.withSession { session ->
            val existingApp =
                internalByNameAndVersion(session, appName, appVersion) ?: throw ApplicationException.NotFound()

            cleanupBeforeDelete(
                session,
                existingApp.getField(ApplicationTable.idName),
                existingApp.getField(ApplicationTable.idVersion))

            session.sendPreparedStatement(
                {
                    setParameter("appname", existingApp.getField(ApplicationTable.idName))
                    setParameter("appversion", existingApp.getField(ApplicationTable.idVersion))
                },
                """
                    DELETE FROM applications
                    WHERE (name = ?appname) AND (version = ?appVersion)
                """.trimIndent()
            )
        }
    }

    private suspend fun cleanupBeforeDelete(ctx: DBContext, appName: String, appVersion: String) {
        ctx.withSession { session ->
            //DELETE FROM FAVORITES
            session.sendPreparedStatement(
                {
                    setParameter("appname", appName)
                    setParameter("appversion", appVersion)
                },
                """
                    DELETE FROM favorited_by
                    WHERE (application_name = ?appname) AND (application_version = ?appVersion)
                """.trimIndent()
            ).rows.toList()
        }
    }

    override suspend fun updateDescription(
        ctx: DBContext,
        user: SecurityPrincipal,
        appName: String,
        appVersion: String,
        newDescription: String?,
        newAuthors: List<String>?
    ) {
        val existing = ctx.withSession { session -> internalByNameAndVersion(session, appName, appVersion) ?: throw ApplicationException.NotFound()}
        if (!canUserPerformWriteOperation(existing.getField(ApplicationTable.owner), user)) throw ApplicationException.NotAllowed()

        ctx.withSession { session ->
            var query =
                """UPDATE applications
                SET 
                """.trimMargin()
            if (newDescription != null) {
                query += """description =?newdesc"""
            }
            if (newAuthors != null) {
                if (newDescription != null) {
                    query += ","
                }
                query += """authors =?newauthors"""
            }
            query += """WHERE (name = ?name) AND (version = ?version)"""
            session.sendPreparedStatement(
                {
                    setParameter("newdesc", newDescription)
                    setParameter("newauthors", newAuthors)
                },
                query
            )
        }
        // We allow for this to be cached for some time. But this instance might as well clear the cache now.
        byNameAndVersionCache.remove(NameAndVersion(appName, appVersion))
    }

    override suspend fun isOwnerOfApplication(ctx: DBContext, user: SecurityPrincipal, appName: String): Boolean =
        ctx.withSession {session -> findOwnerOfApplication(session, appName)!! == user.username}


    override suspend fun preparePageForUser(
        ctx: DBContext,
        user: String?,
        page: Page<Application>
    ): Page<ApplicationWithFavoriteAndTags> {
        if (!user.isNullOrBlank()) {
            val allFavorites = ctx.withSession { session ->
                session.sendPreparedStatement(
                    {
                        setParameter("user", user)
                    },
                    """
                        SELECT * 
                        FROM favorited_by
                        WHERE the_user = ?user
                    """.trimIndent()
                ).rows.toList()
            }

            val allApplicationsOnPage = page.items.map { it.metadata.name }.toSet()
            val allTagsForApplicationsOnPage = ctx.withSession { session ->
                session.sendPreparedStatement(
                    {
                        setParameter("allapps", allApplicationsOnPage.toList())
                    },
                    """
                        SELECT *
                        FROM tags
                        WHERE application_name IN ?allapps
                    """.trimIndent()
                ).rows.toList()
            }

            val preparedPageItems = page.items.map { item ->
                val isFavorite = allFavorites.any { fav ->
                    fav.getField(FavoriteApplicationTable.applicationName) == item.metadata.name &&
                            fav.getField(FavoriteApplicationTable.applicationVersion) == item.metadata.version
                }

                val allTagsForApplication = allTagsForApplicationsOnPage
                    .filter { item.metadata.name == it.getField(TagTable.applicationName) }
                    .map { it.getField(TagTable.tag) }
                    .toSet()
                    .toList()

                ApplicationWithFavoriteAndTags(item.metadata, item.invocation, isFavorite, allTagsForApplication)
            }

            return Page(page.itemsInTotal, page.itemsPerPage, page.pageNumber, preparedPageItems)
        } else {
            val preparedPageItems = page.items.map { item ->
                val allTagsForApplication = ctx.withSession { session ->
                    session.sendPreparedStatement(
                        {
                            setParameter("appname", item.metadata.name)
                        },
                        """
                            SELECT * 
                            FROM application_tags
                            WHERE application_name = ?appname
                        """.trimIndent()
                    ).rows.map { it.getField(TagTable.tag) }.toSet().toList()
                }

                ApplicationWithFavoriteAndTags(item.metadata, item.invocation, false, allTagsForApplication)
            }
            return Page(page.itemsInTotal, page.itemsPerPage, page.pageNumber, preparedPageItems)
        }
    }

    override suspend fun findLatestByTool(
        ctx: DBContext,
        user: SecurityPrincipal,
        project: String?,
        projectGroups: List<String>,
        tool: String,
        paging: NormalizedPaginationRequest
    ): Page<Application> {
        val groups = if (projectGroups.isEmpty()) {
            listOf("")
        } else {
            projectGroups
        }

        val items = ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("toolName", tool)
                    setParameter("user", user.username)
                    setParameter("role", user.role.toString())
                    setParameter("project", project)
                    setParameter("groups", groups)
                    setParameter("privileged", Roles.PRIVILEDGED.toList())
                },
                """
                    SELECT A.*
                    FROM applications AS A 
                    WHERE 
                        (A.created_at) IN (
                            SELECT MAX(created_at)
                            FROM applications AS B
                            WHERE A.name = B.name
                            GROUP BY name
                        ) AND A.tool_name = ?toolName AND (
                            (
                                A.is_public = TRUE
                            ) OR (
                                cast(?project as text) is null AND ?user in (
                                    SELECT P1.username FROM permissions AS P1 WHERE P1.application_name = A.name
                                )
                            ) OR (
                                cast(?project as text) is not null AND exists (
                                    SELECT P2.project_group
                                    FROM permissions AS P2
                                    WHERE
                                        P2.application_name = A.name AND
                                        P2.project = cast(?project as text) AND
                                        P2.project_group in (?groups)
                                )
                            ) or (
                                ?role in (?privileged)
                            ) 
                        )
                    order by A.name
                """.trimIndent()
            ).rows.toList()
        }

        return Page(items.size, paging.itemsPerPage, paging.page, items.map { it.toApplicationWithInvocation() })
    }

    override suspend fun findAllByID(
        ctx: DBContext,
        user: SecurityPrincipal,
        project: String?,
        projectGroups: List<String>,
        embeddedNameAndVersionList: List<EmbeddedNameAndVersion>,
        paging: NormalizedPaginationRequest
    ): List<RowData> {
        if (embeddedNameAndVersionList.isEmpty()) {
            return emptyList()
        }
        return ctx.withSession { session ->
            var query = """
                    SELECT *
                    FROM applications
                    WHERE 
                """.trimIndent()
            embeddedNameAndVersionList.forEachIndexed{ index, _ ->
                query += """ (name = ?name$index AND version = ?version$index) """
                if (index != embeddedNameAndVersionList.size) {
                    query += """ OR """
                }
            }

            session.sendPreparedStatement(
                {
                    embeddedNameAndVersionList.forEachIndexed { index, embeddedNameAndVersion ->
                        setParameter("name$index", embeddedNameAndVersion.name)
                        setParameter("version$index", embeddedNameAndVersion.version)
                    }
                },
                query
            ).rows.toList()
        }
    }
}

internal fun RowData.toApplicationMetadata(): ApplicationMetadata {
    val authors = defaultMapper.readValue<List<String>>(getField(ApplicationTable.authors))

    return ApplicationMetadata(
        getField(ApplicationTable.idName),
        getField(ApplicationTable.idVersion),
        authors,
        getField(ApplicationTable.title),
        getField(ApplicationTable.description),
        getField(ApplicationTable.website),
        getField(ApplicationTable.isPublic)
    )
}

internal fun RowData.toApplicationSummary(): ApplicationSummary {
    return ApplicationSummary(toApplicationMetadata())
}

internal fun RowData.toApplicationWithInvocation(): Application {
    return Application(
        toApplicationMetadata(),
        defaultMapper.readValue<ApplicationInvocationDescription>(getField(ApplicationTable.application))
    )
}

sealed class ApplicationException(why: String, httpStatusCode: HttpStatusCode) : RPCException(why, httpStatusCode) {
    class NotFound : ApplicationException("Not found", HttpStatusCode.NotFound)
    class NotAllowed : ApplicationException("Not allowed", HttpStatusCode.Forbidden)
    class AlreadyExists : ApplicationException("Already exists", HttpStatusCode.Conflict)
    class BadToolReference : ApplicationException("Tool does not exist", HttpStatusCode.BadRequest)
    class BadApplication : ApplicationException("Application does not exists", HttpStatusCode.NotFound)
}
