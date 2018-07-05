package dk.sdu.cloud.storage.services

import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.Page
import dk.sdu.cloud.service.asEnumSet
import dk.sdu.cloud.service.asInt
import dk.sdu.cloud.service.db.*
import dk.sdu.cloud.storage.api.*
import java.util.*
import javax.persistence.*
import javax.persistence.criteria.Predicate

private const val COL_SHARED_WITH = "shared_with"
private const val COL_PATH = "path"

@Entity
@Table(
    name = "shares",
    uniqueConstraints = [
        UniqueConstraint(columnNames = [COL_SHARED_WITH, COL_PATH])
    ]
)
data class ShareEntity(
    @Id
    @GeneratedValue
    var id: Long = 0,

    var owner: String,

    @Column(name = COL_SHARED_WITH)
    var sharedWith: String,

    @Column(name = COL_PATH)
    var path: String,

    var rights: Int,

    @Temporal(TemporalType.TIMESTAMP)
    var createdAt: Date,

    @Temporal(TemporalType.TIMESTAMP)
    var modifiedAt: Date,

    @Enumerated(EnumType.ORDINAL)
    var state: ShareState
) {
    companion object : HibernateEntity<ShareEntity>, WithId<Long>
}

class ShareHibernateDAO : ShareDAO<HibernateSession> {
    override fun find(
        session: HibernateSession,
        user: String,
        shareId: Long
    ): Share {
        return shareById(session, user, shareId, requireOwnership = false).toModel()
    }

    override fun list(
        session: HibernateSession,
        user: String,
        paging: NormalizedPaginationRequest
    ): Page<SharesByPath> {
        // Query number of paths and retrieve for current page
        val itemsInTotal = session.countByPredicate<ShareEntity>(
            distinct = true,
            selection = { entity[ShareEntity::path] },
            builder = { isAuthorized(user, requireOwnership = false) }
        )

        val distinctPaths = session.createCriteriaBuilder<String, ShareEntity>().run {
            with(criteria) {
                select(entity[ShareEntity::path])
                distinct(true)

                where(isAuthorized(user, requireOwnership = false))

                orderBy(ascending(entity[ShareEntity::path]))
            }
        }.createQuery(session).paginatedList(paging)

        // Retrieve all shares for these paths and group
        val groupedByPath = session
            .criteria<ShareEntity> { entity[ShareEntity::path] isInCollection distinctPaths }
            .list()
            .map { it.toModel() }
            .let { groupByPath(user, it) }

        assert(distinctPaths.size == groupedByPath.size)

        return Page(
            itemsInTotal.toInt(),
            paging.itemsPerPage,
            paging.page,
            groupedByPath
        )
    }

    override fun findSharesForPath(
        session: HibernateSession,
        user: String,
        path: String
    ): SharesByPath {
        return session.criteria<ShareEntity> {
            allOf(
                isAuthorized(user, requireOwnership = false),
                entity[ShareEntity::path] equal literal(path)
            )
        }.list()
            .map { it.toModel() }
            .let { groupByPath(user, it).single() }
    }

    private fun groupByPath(user: String, shares: List<Share>): List<SharesByPath> {
        if (shares.isEmpty()) throw ShareException.NotFound()

        val byPath = shares.groupBy { it.path }
        return byPath.map { (path, sharesForPath) ->
            val owner = sharesForPath.first().owner
            val sharedByMe = owner == user
            SharesByPath(path, owner, sharedByMe, sharesForPath.map { it.minimalize() })
        }
    }

    override fun create(
        session: HibernateSession,
        user: String,
        share: Share
    ): Long {
        val exists = session.criteria<ShareEntity> {
            allOf(
                entity[ShareEntity::path] equal literal(share.path),
                entity[ShareEntity::sharedWith] equal literal(share.sharedWith)
            )
        }.uniqueResult() != null

        if (exists) throw ShareException.DuplicateException()

        return session.save(share.toEntity(copyId = false)) as Long
    }

    override fun updateState(
        session: HibernateSession,
        user: String,
        shareId: Long,
        newState: ShareState
    ): Share {
        val entity = shareById(session, user, shareId, requireOwnership = false)
        entity.state = newState
        entity.modifiedAt = Date()
        session.update(entity)
        return entity.toModel()
    }

    override fun updateRights(
        session: HibernateSession,
        user: String,
        shareId: Long,
        rights: Set<AccessRight>
    ): Share {
        val entity = shareById(session, user, shareId, requireOwnership = true)
        entity.rights = rights.asInt()
        entity.modifiedAt = Date()
        session.update(entity)
        return entity.toModel()
    }

    override fun deleteShare(
        session: HibernateSession,
        user: String,
        shareId: Long
    ): Share {
        val entity = shareById(session, user, shareId, requireOwnership = false)
        session.delete(entity)
        return entity.toModel()
    }

    private fun shareById(
        session: HibernateSession,
        user: String,
        shareId: Long,
        requireOwnership: Boolean
    ): ShareEntity {
        return session.criteria<ShareEntity> {
            allOf(
                isAuthorized(user, requireOwnership),
                entity[ShareEntity::id] equal shareId
            )
        }.uniqueResult() ?: throw ShareException.NotFound()
    }

    private fun CriteriaBuilderContext<*, ShareEntity>.isAuthorized(
        user: String,
        requireOwnership: Boolean
    ): Predicate {
        val isOwner = entity[ShareEntity::owner] equal literal(user)
        val isSharedWith = entity[ShareEntity::sharedWith] equal literal(user)

        val options = arrayListOf(isOwner)
        if (!requireOwnership) options += isSharedWith

        return anyOf(*options.toTypedArray())
    }

    private fun Share.toEntity(copyId: Boolean): ShareEntity {
        return ShareEntity(
            if (copyId) id!!.toLong() else 0,
            owner,
            sharedWith,
            path,
            rights.asInt(),
            Date(),
            Date(),
            state
        )
    }

    private fun ShareEntity.toModel(): Share =
        Share(
            owner,
            sharedWith,
            path,
            rights.asEnumSet(),
            createdAt.time,
            modifiedAt.time,
            state,
            id
        )
}

