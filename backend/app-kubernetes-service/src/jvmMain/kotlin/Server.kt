package dk.sdu.cloud.app.kubernetes

import dk.sdu.cloud.accounting.api.ProductReference
import dk.sdu.cloud.app.kubernetes.rpc.*
import dk.sdu.cloud.app.kubernetes.services.*
import dk.sdu.cloud.app.kubernetes.services.proxy.ApplicationProxyService
import dk.sdu.cloud.app.kubernetes.services.proxy.EnvoyConfigurationService
import dk.sdu.cloud.app.kubernetes.services.proxy.TunnelManager
import dk.sdu.cloud.app.kubernetes.services.proxy.VncService
import dk.sdu.cloud.app.kubernetes.services.proxy.WebService
import dk.sdu.cloud.app.orchestrator.api.IngressSupport
import dk.sdu.cloud.auth.api.JwtRefresher
import dk.sdu.cloud.auth.api.RefreshingJWTAuthenticator
import dk.sdu.cloud.calls.client.*
import dk.sdu.cloud.debug.DebugSystem
import dk.sdu.cloud.file.ucloud.services.*
import dk.sdu.cloud.micro.*
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.async.AsyncDBSessionFactory
import dk.sdu.cloud.service.k8.KubernetesClient
import dk.sdu.cloud.service.k8.KubernetesConfigurationSource
import io.ktor.routing.routing
import kotlinx.coroutines.*
import java.io.File
import java.util.*

class Server(
    override val micro: Micro,
    private val configuration: Configuration,
    private val cephConfig: CephConfiguration,
) : CommonServer {
    override val log = logger()
    private lateinit var tunnelManager: TunnelManager
    private lateinit var vncService: VncService
    private lateinit var webService: WebService
    private lateinit var k8Dependencies: K8Dependencies

    override fun start() {
        if (!configuration.enabled) return
        val (refreshToken, validation) =
            if (configuration.providerRefreshToken == null || configuration.ucloudCertificate == null) {
                if (!micro.developmentModeEnabled) {
                    throw IllegalStateException("Missing configuration at app.kubernetes.providerRefreshToken")
                }
                Pair("REPLACED_LATER", InternalTokenValidationJWT.withSharedSecret(UUID.randomUUID().toString()))
            } else {
                Pair(
                    configuration.providerRefreshToken,
                    InternalTokenValidationJWT.withPublicCertificate(configuration.ucloudCertificate)
                )
            }

        val authenticator = RefreshingJWTAuthenticator(micro.client, JwtRefresher.Provider(refreshToken, OutgoingHttpCall))
        @Suppress("UNCHECKED_CAST")
        micro.providerTokenValidation = validation as TokenValidation<Any>

        val broadcastingStream = BroadcastingStream(micro)
        val distributedLocks = DistributedLockFactory(micro)
        val nameAllocator = NameAllocator()
        val db = AsyncDBSessionFactory(micro)

        val debug = micro.featureOrNull(DebugSystem)
        val serviceClient = authenticator.authenticateClient(OutgoingHttpCall)
        val jobCache = VerifiedJobCache(serviceClient)
        k8Dependencies = K8Dependencies(
            KubernetesClient(
                if (configuration.kubernetesConfig != null) {
                    KubernetesConfigurationSource.KubeConfigFile(configuration.kubernetesConfig, null)
                } else {
                    KubernetesConfigurationSource.Auto
                }
            ),

            micro.backgroundScope,
            serviceClient,
            nameAllocator,
            DockerImageSizeQuery(),
            debug,
            jobCache,
        )

        val logService = K8LogService(k8Dependencies)
        val maintenance = MaintenanceService(db, k8Dependencies)
        val utilizationService = UtilizationService(k8Dependencies)
        val resourceCache = ResourceCache(k8Dependencies)
        val sessions = SessionDao()
        val ingressService =
            if (configuration.ingress.enabled) {
                IngressService(
                    IngressSupport(
                        configuration.prefix,
                        "." + configuration.domain,
                        ProductReference(
                            configuration.ingress.product.id,
                            configuration.ingress.product.category,
                            configuration.providerId
                        )
                    ),
                    db,
                    k8Dependencies
                )
            } else {
                null
            }
        val licenseService = LicenseService(configuration.providerId, k8Dependencies, db)
        val networkIpService = if (configuration.networkIp.enabled) {
            NetworkIPService(
                db,
                k8Dependencies,
                configuration.networkInterface ?: "",
                with(configuration.networkIp.product) {
                    ProductReference(id, category, configuration.providerId)
                }
            )
        } else {
            null
        }

        val fsRootFile =
            File((cephConfig.cephfsBaseMount ?: "/mnt/cephfs/") + cephConfig.subfolder).takeIf { it.exists() }
                ?: if (micro.developmentModeEnabled) File("./fs") else throw IllegalStateException("No mount found!")
        val pathConverter = PathConverter(configuration.providerId, "", InternalFile(fsRootFile.absolutePath), serviceClient)
        val fs = NativeFS(pathConverter)
        val memberFiles = MemberFiles(fs, pathConverter, serviceClient)

        val jobManagement = JobManagement(
            configuration.providerId,
            k8Dependencies,
            distributedLocks,
            logService,
            jobCache,
            maintenance,
            resourceCache,
            db,
            sessions,
            micro.developmentModeEnabled,
        ).apply {
            register(TaskPlugin(
                configuration.toleration,
                configuration.useSmallReservation && micro.developmentModeEnabled,
                configuration.useMachineSelector == true,
                configuration.nodes,
            ))
            register(ParameterPlugin(licenseService, pathConverter))
            val fileMountPlugin = FileMountPlugin(
                fs,
                memberFiles,
                pathConverter,
                LimitChecker(db, pathConverter),
                cephConfig
            )
            register(fileMountPlugin)
            register(MultiNodePlugin)
            register(SharedMemoryPlugin)
            register(ExpiryPlugin)
            register(AccountingPlugin)
            register(MiscellaneousPlugin)
            register(NetworkLimitPlugin)
            register(FairSharePlugin)
            if (micro.developmentModeEnabled) register(MinikubePlugin)
            if (ingressService != null) register(ingressService)
            if (networkIpService != null) register(networkIpService)
            register(FirewallPlugin(db, configuration.networkGatewayCidr))
            register(ProxyPlugin(broadcastingStream, ingressService))
            register(FileOutputPlugin(pathConverter, fs, logService, fileMountPlugin))

            // NOTE(Dan): Kata Containers are not currently enabled due to various limitations in Kata containers
            // related to our infrastructure setup
            // register(KataContainerPlugin())
        }

        val envoyConfigurationService = EnvoyConfigurationService(
            File("./envoy/rds.yaml"),
            File("./envoy/clusters.yaml")
        )

        run {
            val port = micro.featureOrNull(ServiceDiscoveryOverrides)?.get(micro.serviceDescription.name)?.port
                ?: 8080
            val renderedConfig =
                Server::class.java.classLoader.getResourceAsStream("config_template.yaml")
                    ?.bufferedReader()
                    ?.readText()
                    ?.replace("\$SERVICE_PORT", port.toString())
                    ?.replace("\$PWD", File("./envoy").absoluteFile.normalize().absolutePath)
                    ?: throw IllegalStateException("Could not find config_template.yml in classpath")

            val configFile = File("./envoy/config.yaml")
            configFile.writeText(renderedConfig)
            log.info("Wrote configuration at ${configFile.absolutePath}")
        }

        tunnelManager = TunnelManager(k8Dependencies)
        tunnelManager.install()

        val applicationProxyService = ApplicationProxyService(
            envoyConfigurationService,
            prefix = configuration.prefix,
            domain = configuration.domain,
            jobCache = jobCache,
            tunnelManager = tunnelManager,
            broadcastingStream = broadcastingStream,
            resources = resourceCache
        )

        vncService = VncService(configuration.providerId, db, sessions, jobCache, resourceCache, tunnelManager)
        webService = WebService(
            providerId = configuration.providerId,
            prefix = configuration.prefix,
            domain = configuration.domain,
            k8 = k8Dependencies,
            devMode = micro.developmentModeEnabled,
            db = db,
            sessions = sessions,
            ingressService = ingressService
        )

        val syncthingService = SyncthingService(
            configuration.providerId, 
            jobManagement, 
            pathConverter,
            memberFiles, 
            fs,
            serviceClient
        ).also {
            jobManagement.register(it)
        }

        configureControllers(
            *buildList {
                add(AppKubernetesController(
                    configuration.providerId,
                    jobManagement,
                    logService,
                    webService,
                    vncService,
                    utilizationService
                ))
                add(MaintenanceController(maintenance, micro.tokenValidation))
                add(ShellController(configuration.providerId, k8Dependencies, db, sessions))
                add(LicenseController(configuration.providerId, licenseService))

                add(SyncthingController(configuration.providerId, syncthingService))

                if (ingressService != null) add(IngressController(configuration.providerId, ingressService))
                if (networkIpService != null) add(NetworkIPController(configuration.providerId, networkIpService))
            }.toTypedArray()
        )

        runBlocking {
            applicationProxyService.initializeListener()
            jobManagement.initializeListeners()
        }

        startServices(wait = false)
    }

    override fun onKtorReady() {
        if (!configuration.enabled) return
        val ktorEngine = micro.feature(ServerFeature).ktorApplicationEngine!!

        ktorEngine.application.routing {
            vncService.install(this)
            webService.install(this)
        }
    }

    override fun stop() {
        super.stop()
        if (!configuration.enabled) return
        tunnelManager.shutdown()
    }
}
