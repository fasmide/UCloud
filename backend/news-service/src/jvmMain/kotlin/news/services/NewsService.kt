package dk.sdu.cloud.news.services

import com.github.jasync.sql.db.RowData
import dk.sdu.cloud.calls.HttpStatusCode
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.mail.api.Mail
import dk.sdu.cloud.mail.api.MailDescriptions
import dk.sdu.cloud.mail.api.SendRequestItem
import dk.sdu.cloud.news.api.NewsPost
import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.Page
import dk.sdu.cloud.service.db.async.*
import org.joda.time.DateTimeZone
import org.joda.time.LocalDateTime

object NewsTable : SQLTable("news") {
    val id = long("id", notNull = true)
    val title = text("title", notNull = true)
    val subtitle = text("subtitle", notNull = true)
    val body = text("body", notNull = true)
    val postedBy = text("posted_by", notNull = true)
    val showFrom = timestamp("show_from", notNull = true)
    val hideFrom = timestamp("hide_from", notNull = false)
    val hidden = bool("hidden", notNull = true)
    val category = text("category", notNull = true)
}

class NewsService {
    suspend fun createNewsPost(
        ctx: DBContext,
        postedBy: String,
        title: String,
        subtitle: String,
        body: String,
        showFrom: Long,
        hideFrom: Long?,
        category: String
    ) {
        ctx.withSession { session ->
            val id = session.allocateId("id_sequence")
            session.insert(NewsTable) {
                set(NewsTable.id, id)
                set(NewsTable.title, title)
                set(NewsTable.subtitle, subtitle)
                set(NewsTable.body, body)
                set(NewsTable.postedBy, postedBy)
                set(NewsTable.showFrom, LocalDateTime(showFrom, DateTimeZone.UTC))
                set(NewsTable.hideFrom, if (hideFrom != null) LocalDateTime(hideFrom, DateTimeZone.UTC) else null)
                set(NewsTable.hidden, false)
                set(NewsTable.category, category)
            }
        }
    }

    suspend fun updateNewsPost(
        ctx: DBContext,
        id: Long,
        title: String,
        subtitle: String,
        body: String,
        showFrom: Long,
        hideFrom: Long?,
        category: String
    ) {
        ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("id", id)
                    setParameter("title", title)
                    setParameter("subtitle", subtitle)
                    setParameter("body", body)
                    setParameter("show_from", LocalDateTime(showFrom, DateTimeZone.UTC))
                    setParameter("hide_from", if (hideFrom != null) LocalDateTime(hideFrom, DateTimeZone.UTC) else null)
                    setParameter("category", category)
                },
                """
                    UPDATE news
                    SET title = :title, subtitle = :subtitle, body = :body, show_from = :show_from,
                        hide_from = :hide_from, category = :category 
                    WHERE :id = id
                """.trimIndent()
            )
        }
    }

    suspend fun deleteNewsPost(
        ctx: DBContext,
        id: Long
    ) {
        ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("id", id)
                },
                """
                    DELETE FROM News
                    WHERE id = :id
                """.trimIndent()
            )
        }
    }

    suspend fun listNewsPosts(
        ctx: DBContext,
        pagination: NormalizedPaginationRequest,
        categoryFilter: String?,
        withHidden: Boolean,
        userIsAdmin: Boolean
    ): Page<NewsPost> {
        return ctx.withSession { session ->
            val items = session
                .sendPreparedStatement(
                    {
                        setParameter("categoryFilter", categoryFilter)
                        setParameter("offset", pagination.page * pagination.itemsPerPage)
                        setParameter("limit", pagination.itemsPerPage)
                        setParameter("withHidden", withHidden && userIsAdmin)
                    },
                    """
                    select
                        n.id,
                        n.title,
                        n.subtitle,
                        n.body,
                        n.posted_by,
                        n.show_from,
                        n.hide_from,
                        n.hidden,
                        n.category
                    from news n
                    where (:categoryFilter::text is null or n.category = :categoryFilter) and
                          (:withHidden = true or n.show_from <= now()) and
                          (:withHidden = true or (n.hide_from is null or n.hide_from > now())) and
                          (:withHidden = true or n.hidden = false)
                    order by n.show_from desc
                    offset :offset
                    limit :limit
                """
                )
                .rows
                .map { it.toNewsPost() }

            Page(items.size, pagination.itemsPerPage, pagination.page, items)
        }
    }

    suspend fun listCategories(
        ctx: DBContext
    ): List<String> {
        return ctx.withSession { session ->
            session
                .sendPreparedStatement(
                    """
                    select distinct news.category
                    from news
                """
                ).rows
                .map { rowData ->
                    rowData.getField(NewsTable.category)
                }
        }
    }

    suspend fun togglePostHidden(ctx: DBContext, id: Long) {
        ctx.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("id", id)
                },
                """
                    UPDATE news 
                    SET hidden = NOT hidden
                    WHERE id = :id
                """
            )
        }
    }

    suspend fun getPostById(ctx: DBContext, id: Long): NewsPost {
        return ctx.withSession { session ->
            session
                .sendPreparedStatement(
                    {
                        setParameter("id", id)
                    },
                    """
                        SELECT *
                        FROM news n
                        WHERE n.id = :id
                    """
                ).rows
                .singleOrNull()
                ?.toNewsPost() ?: throw RPCException.fromStatusCode(HttpStatusCode.NotFound)
        }
    }
}

fun RowData.toNewsPost(): NewsPost {
    return NewsPost(
        id = getField(NewsTable.id),
        title = getField(NewsTable.title),
        subtitle = getField(NewsTable.subtitle),
        body = getField(NewsTable.body),
        postedBy = getField(NewsTable.postedBy),
        showFrom = getField(NewsTable.showFrom).toDateTime().millis,
        hideFrom = getFieldNullable(NewsTable.hideFrom)?.let { it.toDateTime().millis },
        hidden = getField(NewsTable.hidden),
        category = getField(NewsTable.category)
    )
}
