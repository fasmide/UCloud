package dk.sdu.cloud.accounting

import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.accounting.rpc.*
import dk.sdu.cloud.accounting.services.grants.GiftService
import dk.sdu.cloud.accounting.services.grants.GrantApplicationService
import dk.sdu.cloud.accounting.services.grants.GrantCommentService
import dk.sdu.cloud.accounting.services.grants.GrantNotificationService
import dk.sdu.cloud.accounting.services.grants.GrantSettingsService
import dk.sdu.cloud.accounting.services.grants.GrantTemplateService
import dk.sdu.cloud.accounting.services.products.ProductService
import dk.sdu.cloud.accounting.services.projects.FavoriteProjectService
import dk.sdu.cloud.accounting.services.projects.ProjectGroupService
import dk.sdu.cloud.accounting.services.projects.ProjectQueryService
import dk.sdu.cloud.accounting.services.projects.ProjectService
import dk.sdu.cloud.accounting.services.providers.ProviderIntegrationService
import dk.sdu.cloud.accounting.services.providers.ProviderService
import dk.sdu.cloud.accounting.services.serviceJobs.LowFundsJob
import dk.sdu.cloud.accounting.services.wallets.AccountingService
import dk.sdu.cloud.accounting.services.wallets.DepositNotificationService
import dk.sdu.cloud.accounting.util.ProjectCache
import dk.sdu.cloud.accounting.util.ProviderComms
import dk.sdu.cloud.accounting.util.Providers
import dk.sdu.cloud.accounting.util.SimpleProviderCommunication
import dk.sdu.cloud.auth.api.authenticator
import dk.sdu.cloud.calls.client.OutgoingHttpCall
import dk.sdu.cloud.grant.rpc.GiftController
import dk.sdu.cloud.grant.rpc.GrantController
import dk.sdu.cloud.micro.*
import dk.sdu.cloud.project.api.ProjectEvents
import dk.sdu.cloud.provider.api.ProviderSupport
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.async.AsyncDBSessionFactory

class Server(
    override val micro: Micro,
    val config: Configuration
) : CommonServer {
    override val log = logger()

    override fun start() {
        val db = AsyncDBSessionFactory(micro)
        val client = micro.authenticator.authenticateClient(OutgoingHttpCall)
        val productService = ProductService(db)
        val projectCache = ProjectCache(DistributedStateFactory(micro), db)

        val simpleProviders = Providers(client) { SimpleProviderCommunication(it.client, it.wsClient, it.provider) }
        val accountingService = AccountingService(db, simpleProviders)
        val depositNotifications = DepositNotificationService(db)

        val favoriteProjects = FavoriteProjectService()
        val eventProducer = micro.eventStreamService.createProducer(ProjectEvents.events)
        val projectService = ProjectService(client, eventProducer, projectCache)
        val projectGroups = ProjectGroupService(projectService, eventProducer, projectCache)
        val projectQueryService = ProjectQueryService(projectService)
        val projectsV2 = dk.sdu.cloud.accounting.services.projects.v2.ProjectService(db, client, projectCache)
        val projectNotifications = dk.sdu.cloud.accounting.services.projects.v2
            .ProviderNotificationService(projectsV2, db, simpleProviders, micro.backgroundScope)

        val giftService = GiftService(db)
        val settings = GrantSettingsService(db)
        val notifications = GrantNotificationService(db, client)
        val grantApplicationService = GrantApplicationService(db, notifications, simpleProviders)
        val templates = GrantTemplateService(db, config)
        val comments = GrantCommentService(db)


        val providerProviders =
            dk.sdu.cloud.accounting.util.Providers<ProviderComms>(client) { it }
        val providerSupport = dk.sdu.cloud.accounting.util.ProviderSupport<ProviderComms, Product, ProviderSupport>(
            providerProviders, client, fetchSupport = { emptyList() })
        val providerService = ProviderService(projectCache, db, providerProviders, providerSupport, client)
        val providerIntegrationService = ProviderIntegrationService(
            db, providerService, client,
            micro.developmentModeEnabled
        )

        val scriptManager = micro.feature(ScriptManager)
        scriptManager.register(
            Script(
                ScriptMetadata(
                    "accounting-low-funds",
                    "Accounting: Low Funds",
                    WhenToStart.Daily(0, 0)
                ),
                script = {
                    val jobs = LowFundsJob(db, client, config)
                    jobs.checkWallets()
                }
            )
        )

        with(micro.server) {
            configureControllers(
                AccountingController(accountingService, depositNotifications),
                ProductController(productService),
                FavoritesController(db, favoriteProjects),
                GiftController(giftService),
                GrantController(grantApplicationService, comments, settings, templates),
                GroupController(db, projectGroups, projectQueryService),
                IntegrationController(providerIntegrationService),
                MembershipController(db, projectQueryService),
                ProjectController(db, projectService, projectQueryService),
                ProviderController(providerService, micro.developmentModeEnabled || micro.commandLineArguments.contains("--allow-provider-approval")),
            )

            if (micro.developmentModeEnabled || micro.commandLineArguments.contains("--projects-v2")) {
                configureControllers(
                    ProjectsControllerV2(projectsV2, projectNotifications),
                )
            }
        }

        startServices()
    }
}
