package dk.sdu.cloud.app.store

import com.fasterxml.jackson.module.kotlin.readValue
import dk.sdu.cloud.Role
import dk.sdu.cloud.SecurityPrincipal
import dk.sdu.cloud.app.store.api.ApplicationDescription
import dk.sdu.cloud.app.store.api.ToolDescription
import dk.sdu.cloud.app.store.rpc.AppStoreController
import dk.sdu.cloud.app.store.rpc.ToolController
import dk.sdu.cloud.app.store.services.AppStoreService
import dk.sdu.cloud.app.store.services.ApplicationHibernateDAO
import dk.sdu.cloud.app.store.services.ElasticDAO
import dk.sdu.cloud.app.store.services.LogoService
import dk.sdu.cloud.app.store.services.ToolHibernateDAO
import dk.sdu.cloud.app.store.util.yamlMapper
import dk.sdu.cloud.micro.Micro
import dk.sdu.cloud.micro.developmentModeEnabled
import dk.sdu.cloud.micro.elasticHighLevelClient
import dk.sdu.cloud.micro.hibernateDatabase
import dk.sdu.cloud.micro.server
import dk.sdu.cloud.service.CommonServer
import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.configureControllers
import dk.sdu.cloud.service.db.withTransaction
import dk.sdu.cloud.service.stackTraceToString
import dk.sdu.cloud.service.startServices
import java.io.File

class Server(override val micro: Micro) : CommonServer {
    override val log = logger()

    override fun start() {
        val elasticDAO = ElasticDAO(micro.elasticHighLevelClient)
        val toolDAO = ToolHibernateDAO()
        val applicationDAO = ApplicationHibernateDAO(toolDAO)


        val db = micro.hibernateDatabase
        val appStoreService = AppStoreService(db, applicationDAO, toolDAO, elasticDAO)
        val logoService = LogoService(db, applicationDAO, toolDAO)

        with(micro.server) {
            configureControllers(
                AppStoreController(appStoreService, logoService),
                ToolController(db, toolDAO, logoService)
            )
        }

        if (micro.developmentModeEnabled) {
            val listOfApps = db.withTransaction {
                applicationDAO.listLatestVersion(it, null, NormalizedPaginationRequest(null, null))
            }

            if (listOfApps.itemsInTotal == 0) {
                val dummyUser = SecurityPrincipal("admin@dev", Role.ADMIN, "admin", "admin", 42000)
                @Suppress("TooGenericExceptionCaught")
                db.withTransaction { session ->
                    val tools = File("yaml", "tools")
                    tools.listFiles()?.forEach {
                        try {
                            val description = yamlMapper.readValue<ToolDescription>(it)
                            toolDAO.create(session, dummyUser, description.normalize())
                        } catch (ex: Exception) {
                            log.info("Could not create tool: $it")
                            log.info(ex.stackTraceToString())
                        }
                    }

                    val apps = File("yaml", "apps")
                    apps.listFiles()?.forEach {
                        try {
                            val description = yamlMapper.readValue<ApplicationDescription>(it)
                            applicationDAO.create(session, dummyUser, description.normalize())
                        } catch (ex: Exception) {
                            log.info("Could not create app: $it")
                            log.info(ex.stackTraceToString())
                        }
                    }
                }
            }
        }

        startServices()
    }
}
