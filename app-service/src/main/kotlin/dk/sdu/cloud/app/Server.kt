package dk.sdu.cloud.app

import dk.sdu.cloud.app.api.AppServiceDescription
import dk.sdu.cloud.app.api.HPCStreams
import dk.sdu.cloud.app.http.AppController
import dk.sdu.cloud.app.http.JobController
import dk.sdu.cloud.app.http.ToolController
import dk.sdu.cloud.app.services.*
import dk.sdu.cloud.app.services.ssh.SSHConnectionPool
import dk.sdu.cloud.auth.api.JWTProtection
import dk.sdu.cloud.auth.api.RefreshingJWTAuthenticatedCloud
import dk.sdu.cloud.auth.api.protect
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.HibernateSessionFactory
import io.ktor.application.install
import io.ktor.routing.route
import io.ktor.routing.routing
import io.ktor.server.engine.ApplicationEngine
import org.apache.kafka.streams.KafkaStreams
import org.apache.kafka.streams.StreamsBuilder
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class Server(
    override val kafka: KafkaServices,
    override val serviceRegistry: ServiceRegistry,
    private val cloud: RefreshingJWTAuthenticatedCloud,
    private val config: HPCConfig,
    private val ktor: HttpServerProvider,
    private val db: HibernateSessionFactory
): CommonServer, WithServiceRegistry {
    private var initialized = false
    override val log: Logger = logger()
    override val endpoints = listOf("api/hpc")


    override lateinit var httpServer: ApplicationEngine
    override lateinit var kStreams: KafkaStreams
    private lateinit var scheduledExecutor: ScheduledExecutorService
    private lateinit var slurmPollAgent: SlurmPollAgent

    override fun start() {
        if (initialized) throw IllegalStateException("Already started!")

        val instance = AppServiceDescription.instance(config.connConfig)

        log.info("Init Core Services")
        scheduledExecutor = Executors.newSingleThreadScheduledExecutor()

        log.info("Init Application Services")
        val sshPool = SSHConnectionPool(config.ssh)
        val sbatchGenerator = SBatchGenerator()
        slurmPollAgent = SlurmPollAgent(sshPool, scheduledExecutor, 0L, 15L, TimeUnit.SECONDS)

        val toolDao = ToolHibernateDAO()
        val applicationDao = ApplicationHibernateDAO(toolDao)
        val jobDao = JobHibernateDAO(applicationDao)
        val jobExecutionService = JobExecutionService(
            cloud,
            kafka.producer.forStream(HPCStreams.appEvents),
            sbatchGenerator,
            db,
            jobDao,
            applicationDao,
            slurmPollAgent,
            sshPool,
            config.ssh.user
        )
        val jobService = JobService(db, jobDao, sshPool, jobExecutionService)

        kStreams = run {
            log.info("Constructing Kafka Streams Topology")
            val kBuilder = StreamsBuilder()

            log.info("Configuring stream processors...")
            kBuilder.stream(HPCStreams.appEvents).foreach { _, event -> jobExecutionService.handleAppEvent(event) }
            log.info("Stream processors configured!")

            kafka.build(kBuilder.build()).also {
                log.info("Kafka Streams Topology successfully built!")
            }
        }

        kStreams.setUncaughtExceptionHandler { _, exception ->
            log.error("Caught fatal exception in Kafka! Stacktrace follows:")
            log.error(exception.stackTraceToString())
            stop()
        }

        httpServer = ktor {
            log.info("Configuring HTTP server")
            installDefaultFeatures(cloud, kafka, instance)
            install(JWTProtection)

            routing {
                route("api/hpc") {
                    protect()

                    AppController(db, applicationDao).configure(this)
                    JobController(db, jobService).configure(this)
                    ToolController(db, toolDao).configure(this)
                }

                configureControllers(
                    AppController(
                        db,
                        applicationDao
                    ),

                    JobController(
                        db,
                        jobService
                    ),

                    ToolController(
                        db,
                        toolDao
                    )
                )
            }
            log.info("HTTP server successfully configured!")
        }

        startServices()
        registerWithRegistry()
    }

    companion object {
        private val log = LoggerFactory.getLogger(Server::class.java)
    }
}
