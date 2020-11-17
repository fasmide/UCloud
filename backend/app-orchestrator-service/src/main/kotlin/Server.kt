package dk.sdu.cloud.app.orchestrator

import app.orchestrator.rpc.PublicLinkController
import dk.sdu.cloud.accounting.api.UCLOUD_PROVIDER
import dk.sdu.cloud.app.orchestrator.api.ComputeProvider
import dk.sdu.cloud.app.orchestrator.api.ComputeProviderManifest
import dk.sdu.cloud.app.orchestrator.api.ComputeProviderManifestBody
import dk.sdu.cloud.app.orchestrator.api.ManifestFeatureSupport
import dk.sdu.cloud.app.orchestrator.processors.AppProcessor
import dk.sdu.cloud.app.orchestrator.services.JobDao
import dk.sdu.cloud.app.orchestrator.rpc.CallbackController
import dk.sdu.cloud.app.orchestrator.rpc.JobController
import dk.sdu.cloud.app.orchestrator.services.*
import dk.sdu.cloud.auth.api.RefreshingJWTAuthenticator
import dk.sdu.cloud.auth.api.authenticator
import dk.sdu.cloud.calls.client.AuthenticatedClient
import dk.sdu.cloud.calls.client.OutgoingHttpCall
import dk.sdu.cloud.calls.client.OutgoingWSCall
import dk.sdu.cloud.micro.*
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.async.AsyncDBSessionFactory
import kotlinx.coroutines.runBlocking

typealias UserClientFactory = (refreshToken: String) -> AuthenticatedClient

class Server(override val micro: Micro, val config: Configuration) : CommonServer {
    override val log = logger()

    override fun start() {
        val db = AsyncDBSessionFactory(micro.databaseConfig)
        val serviceClient = micro.authenticator.authenticateClient(OutgoingHttpCall)
        val serviceClientWS = micro.authenticator.authenticateClient(OutgoingWSCall)
        val streams = micro.eventStreamService
        val distributedLocks = DistributedLockBestEffortFactory(micro)
        val appStoreCache = AppStoreCache(serviceClient)
        val jobDao = JobDao()
        val userClientFactory: UserClientFactory = { refreshToken ->
            RefreshingJWTAuthenticator(
                micro.client,
                refreshToken,
                micro.tokenValidation as TokenValidationJWT
            ).authenticateClient(OutgoingHttpCall)
        }

        val machineCache = MachineTypeCache(serviceClient)
        val paymentService = PaymentService(db, serviceClient)
        val parameterExportService = ParameterExportService()
        val jobFileService = JobFileService(userClientFactory, parameterExportService, serviceClient, appStoreCache)
        val publicLinks = PublicLinkService()

        val jobQueryService = JobQueryService(
            db,
            jobFileService,
            ProjectCache(serviceClient),
            appStoreCache,
            publicLinks
        )

        val providers = Providers(serviceClient, ComputeProviderManifest(
            ComputeProvider(UCLOUD_PROVIDER, "localhost", false, 8080),
            ComputeProviderManifestBody(
                ManifestFeatureSupport(
                    web = true,
                    vnc = true,
                    batch = true,
                    docker = true,
                    virtualMachine = false,
                    logs = true
                )
            )
        ))

        val jobVerificationService = JobVerificationService(
            appStoreCache,
            db,
            jobQueryService,
            serviceClient,
            providers,
            machineCache
        )

        val jobOrchestrator =
            JobOrchestrator(
                serviceClient,
                db,
                jobVerificationService,
                jobFileService,
                jobDao,
                jobQueryService,
                micro.backgroundScope,
                paymentService,
                providers,
                userClientFactory
            )

        val jobMonitoring = JobMonitoringService(
            db,
            micro.backgroundScope,
            distributedLocks,
            appStoreCache,
            jobVerificationService,
            jobOrchestrator,
            serviceClient
        )

        val streamFollowService =
            StreamFollowService(
                jobFileService,
                serviceClient,
                serviceClientWS,
                jobQueryService,
                micro.backgroundScope
            )

        AppProcessor(
            streams,
            jobOrchestrator,
            appStoreCache
        ).init()

        runBlocking { jobMonitoring.initialize() }

        with(micro.server) {
            configureControllers(
                JobController(
                    jobQueryService,
                    jobOrchestrator,
                    streamFollowService,
                    userClientFactory,
                    serviceClient,
                    machineCache
                ),

                CallbackController(jobOrchestrator),

                PublicLinkController(
                    db,
                    jobQueryService,
                    publicLinks
                )
            )
        }

        startServices()
    }
}