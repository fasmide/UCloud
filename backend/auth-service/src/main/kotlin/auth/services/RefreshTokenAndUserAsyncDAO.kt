package dk.sdu.cloud.auth.services

import com.fasterxml.jackson.module.kotlin.readValue
import com.github.jasync.sql.db.RowData
import dk.sdu.cloud.SecurityScope
import dk.sdu.cloud.defaultMapper
import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.Page
import dk.sdu.cloud.service.db.async.DBContext
import dk.sdu.cloud.service.db.async.SQLTable
import dk.sdu.cloud.service.db.async.getField
import dk.sdu.cloud.service.db.async.insert
import dk.sdu.cloud.service.db.async.jsonb
import dk.sdu.cloud.service.db.async.long
import dk.sdu.cloud.service.db.async.sendPreparedStatement
import dk.sdu.cloud.service.db.async.text
import dk.sdu.cloud.service.db.async.timestamp
import dk.sdu.cloud.service.db.async.withSession
import dk.sdu.cloud.service.mapItems
import dk.sdu.cloud.service.paginate
import org.joda.time.DateTimeZone
import org.joda.time.LocalDateTime
import java.util.*

data class RefreshTokenAndUser(
    val associatedUser: String,

    val token: String,

    val csrf: String,

    val refreshTokenExpiry: Long? = null,

    /**
     * An opaque token that uniquely identifies a refresh token.
     *
     * This session reference __must not__ be used by any client. This session reference will be embedded in JWTs.
     * This makes them readable by the end-user. It is __very__ important that we do not leak refresh tokens into
     * the JWT. This reference is added solely for the purpose of auditing.
     */
    val publicSessionReference: String? = UUID.randomUUID().toString(),

    val expiresAfter: Long = 1000L * 60 * 10,

    val scopes: List<SecurityScope> = listOf(SecurityScope.ALL_WRITE),

    val extendedBy: String? = null,

    val extendedByChain: List<String> = emptyList(),

    val userAgent: String? = null,

    val ip: String? = null,

    val createdAt: Long = System.currentTimeMillis()
)
/**
 * Updated in:
 *
 * - V1__Initial.sql
 * - V2__CSRF.sql
 * - V3__Session_id.sql
 * - V5__Refresh_Templates.sql
 * - V6__Refresh_Expiry.sql
 * - V9__Extended_by_chain.sql
 */
object RefreshTokenTable : SQLTable("refresh_tokens") {
    val token = text("token", notNull = true)
    val associatedUser = text("associated_user_id", notNull = true)
    val csrf = text("csrf", notNull = true)
    val refreshTokenExpiry = long("refresh_token_expiry")
    val publicSessionReference = text("public_session_reference")
    val expiresAfter = long("expires_after", notNull = true)
    val scopes = jsonb("scopes", notNull = true)
    val extendedBy = text("extended_by")
    val extendedByChain = jsonb("extended_by_chain", notNull = true)
    val userAgent = text("user_agent")
    val ip = text("ip")
    val createdAt = timestamp("created_at")
}

class RefreshTokenAsyncDAO{
    suspend fun findTokenForUser(db: DBContext, user: String): RefreshTokenAndUser? {
        return db.withSession { session ->
            session
                .sendPreparedStatement(
                    {
                        setParameter("id", user)
                    },
                    """
                        SELECT *
                        FROM refresh_tokens
                        WHERE associated_user_id = ?id
                    """.trimIndent()
                ).rows.firstOrNull()?.toRefreshTokenAndUser()
        }
    }

    suspend fun findById(db: DBContext, token: String): RefreshTokenAndUser? {
        return db.withSession { session ->
            session
                .sendPreparedStatement(
                    {
                        setParameter("token", token)
                        setParameter("time", LocalDateTime.now(DateTimeZone.UTC).toDateTime().millis)
                    },
                    """
                        SELECT *
                        FROM refresh_tokens
                        WHERE token = ?token AND (
                            refresh_token_expiry is NULL OR
                            refresh_token_expiry > ?time
                        )
                    """.trimIndent()
                ).rows.singleOrNull()?.toRefreshTokenAndUser()
        }
    }

    suspend fun insert(db: DBContext, tokenAndUser: RefreshTokenAndUser) {
       db.withSession { session ->
           val principal = session
                .sendPreparedStatement(
                    {
                        setParameter("user", tokenAndUser.associatedUser)
                    },
                    """
                        SELECT * 
                        FROM principals
                        WHERE id = ?user
                    """.trimIndent()
                ).rows.singleOrNull()?.getField(PrincipalTable.id) ?: throw UserException.NotFound()
           session.insert(RefreshTokenTable) {
               set(RefreshTokenTable.associatedUser, principal)
               set(RefreshTokenTable.token, tokenAndUser.token)
               set(RefreshTokenTable.csrf, tokenAndUser.csrf)
               set(RefreshTokenTable.refreshTokenExpiry, tokenAndUser.refreshTokenExpiry)
               set(RefreshTokenTable.publicSessionReference, tokenAndUser.publicSessionReference)
               set(RefreshTokenTable.expiresAfter, tokenAndUser.expiresAfter)
               set(RefreshTokenTable.scopes, defaultMapper.writeValueAsString(tokenAndUser.scopes.map { it.toString() }))
               set(RefreshTokenTable.extendedBy, tokenAndUser.extendedBy)
               set(RefreshTokenTable.extendedByChain, defaultMapper.writeValueAsString(tokenAndUser.extendedByChain))
               set(RefreshTokenTable.userAgent, tokenAndUser.userAgent)
               set(RefreshTokenTable.ip, tokenAndUser.ip)
               set(RefreshTokenTable.createdAt, LocalDateTime(tokenAndUser.createdAt, DateTimeZone.UTC))

           }
        }
    }

    suspend fun updateCsrf(db: DBContext, token: String, newCsrf: String) {
        db.withSession { session ->
            //Check to see if token exists
            session
                .sendPreparedStatement(
                    {
                        setParameter("token", token)
                    },
                    """
                        SELECT *
                        FROM refresh_tokens
                        WHERE token = ?token
                    """.trimIndent()
                ).rows.singleOrNull() ?: throw UserException.NotFound()

            //if exists -> update
            session.sendPreparedStatement(
                {
                    setParameter("token", token)
                    setParameter("csrf", newCsrf)
                },
                """
                    UPDATE refresh_tokens
                    SET csrf = ?csrf
                    WHERE token = ?token
                """.trimIndent()
            )
        }
    }

    suspend fun delete(db: DBContext, token: String): Boolean {
        return db.withSession { session ->
            session.sendPreparedStatement(
                {
                    setParameter("token", token)
                },
                """
                    DELETE FROM refresh_tokens
                    WHERE token = ?token
                """.trimIndent()
            ).rowsAffected > 0
        }
    }

    suspend fun deleteExpired(db: DBContext) {
        db.withSession { session ->
            session
                .sendPreparedStatement(
                    {
                        setParameter("time", LocalDateTime.now(DateTimeZone.UTC).toDateTime().millis)
                    },
                    """
                        DELETE FROM refresh_tokens
                        WHERE refresh_token_expiry < ?time
                    """.trimIndent()
                )
        }
    }

    suspend fun findUserSessions(
        db: DBContext,
        username: String,
        pagination: NormalizedPaginationRequest
    ): Page<RefreshTokenAndUser> {
        return db.withSession { session ->
            session
                .sendPreparedStatement(
                    {
                        setParameter("user", username)
                    },
                    """
                        SELECT *
                        FROM refresh_tokens
                        WHERE associated_user_id = ?user AND
                                extended_by is NULL
                    """.trimIndent()
                ).rows.paginate(pagination)
                .mapItems { it.toRefreshTokenAndUser() }
        }
    }

    suspend fun invalidateUserSessions(db: DBContext, username: String) {
        db.withSession { session ->
            session
                .sendPreparedStatement(
                    {
                        setParameter("user", username)
                    },
                    """
                        DELETE FROM refresh_tokens
                        WHERE associated_user_id = ?user AND 
                                extended_by is NULL
                    """.trimIndent()
                )
        }
    }
}

fun RowData.toRefreshTokenAndUser(): RefreshTokenAndUser {
    val scopes = defaultMapper.readValue<List<String>>(getField(RefreshTokenTable.scopes))
    val extendedByChain = defaultMapper.readValue<List<String>>(getField(RefreshTokenTable.extendedByChain))
    return RefreshTokenAndUser(
        associatedUser = getField(RefreshTokenTable.associatedUser),
        token = getField(RefreshTokenTable.token),
        csrf = getField(RefreshTokenTable.csrf),
        refreshTokenExpiry = getField(RefreshTokenTable.refreshTokenExpiry),
        publicSessionReference = getField(RefreshTokenTable.publicSessionReference),
        expiresAfter = getField(RefreshTokenTable.expiresAfter),
        scopes = scopes.map { SecurityScope.parseFromString(it) },
        extendedBy = getField(RefreshTokenTable.extendedBy),
        extendedByChain = extendedByChain,
        ip = getField(RefreshTokenTable.ip),
        userAgent = getField(RefreshTokenTable.userAgent),
        createdAt = getField(RefreshTokenTable.createdAt).toDateTime(DateTimeZone.UTC).millis
    )
}
