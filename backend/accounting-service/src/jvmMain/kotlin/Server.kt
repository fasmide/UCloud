package dk.sdu.cloud.accounting

import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.accounting.rpc.AccountingController
import dk.sdu.cloud.accounting.rpc.Docs
import dk.sdu.cloud.accounting.rpc.FavoritesController
import dk.sdu.cloud.accounting.rpc.GroupController
import dk.sdu.cloud.accounting.rpc.IntegrationController
import dk.sdu.cloud.accounting.rpc.MembershipController
import dk.sdu.cloud.accounting.rpc.ProductController
import dk.sdu.cloud.accounting.rpc.ProjectController
import dk.sdu.cloud.accounting.rpc.ProviderController
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
import dk.sdu.cloud.accounting.services.wallets.AccountingService
import dk.sdu.cloud.accounting.services.wallets.DepositNotificationService
import dk.sdu.cloud.accounting.util.ProviderComms
import dk.sdu.cloud.accounting.util.Providers
import dk.sdu.cloud.accounting.util.SimpleProviderCommunication
import dk.sdu.cloud.auth.api.authenticator
import dk.sdu.cloud.calls.client.OutgoingHttpCall
import dk.sdu.cloud.grant.rpc.GiftController
import dk.sdu.cloud.grant.rpc.GrantController
import dk.sdu.cloud.micro.Micro
import dk.sdu.cloud.micro.commandLineArguments
import dk.sdu.cloud.micro.databaseConfig
import dk.sdu.cloud.micro.developmentModeEnabled
import dk.sdu.cloud.micro.eventStreamService
import dk.sdu.cloud.micro.server
import dk.sdu.cloud.project.api.ProjectEvents
import dk.sdu.cloud.provider.api.ProviderSupport
import dk.sdu.cloud.service.CommonServer
import dk.sdu.cloud.service.configureControllers
import dk.sdu.cloud.service.db.async.AsyncDBSessionFactory
import dk.sdu.cloud.service.startServices

class Server(
    override val micro: Micro,
    val config: Configuration
) : CommonServer {
    override val log = logger()

    override fun start() {
        val db = AsyncDBSessionFactory(micro.databaseConfig)
        val client = micro.authenticator.authenticateClient(OutgoingHttpCall)
        val productService = ProductService(db)

        val simpleProviders = Providers(client) { SimpleProviderCommunication(it.client, it.wsClient, it.provider) }
        val accountingService = AccountingService(db, simpleProviders)
        val depositNotifications = DepositNotificationService(db)

        val favoriteProjects = FavoriteProjectService()
        val eventProducer = micro.eventStreamService.createProducer(ProjectEvents.events)
        val projectService = ProjectService(client, eventProducer)
        val projectGroups = ProjectGroupService(projectService, eventProducer)
        val projectQueryService = ProjectQueryService(projectService)

        val giftService = GiftService(db)
        val settings = GrantSettingsService(db)
        val notifications = GrantNotificationService(db, client)
        val grantApplicationService = GrantApplicationService(db, notifications)
        val templates = GrantTemplateService(db, config)
        val comments = GrantCommentService(db)

        val providerProviders =
            dk.sdu.cloud.accounting.util.Providers<ProviderComms>(client) { it }
        val providerSupport = dk.sdu.cloud.accounting.util.ProviderSupport<ProviderComms, Product, ProviderSupport>(
            providerProviders, client, fetchSupport = { emptyList() })
        val providerService = ProviderService(db, providerProviders, providerSupport, client)
        val providerIntegrationService = ProviderIntegrationService(
            db, providerService, client,
            micro.developmentModeEnabled
        )

        if (micro.commandLineArguments.contains("--low-funds-check")) {
            TODO()
            /*
            val jobs = LowFundsJob(db, client, config)
            try {
                jobs.notifyLowFundsWallets()
                exitProcess(0)
            } catch (ex: Throwable) {
                log.warn(ex.stackTraceToString())
                exitProcess(1)
            }
             */
        }

        with(micro.server) {
            configureControllers(
                AccountingController(accountingService, depositNotifications),
                ProductController(productService),
                Docs(),
                FavoritesController(db, favoriteProjects),
                GiftController(giftService),
                GrantController(grantApplicationService, comments, settings, templates),
                GroupController(db, projectGroups, projectQueryService),
                IntegrationController(providerIntegrationService),
                MembershipController(db, projectQueryService),
                ProjectController(db, projectService, projectQueryService),
                ProviderController(providerService, micro.developmentModeEnabled),
            )
        }

        startServices()
    }
}
