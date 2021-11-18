package dk.sdu.cloud.file.ucloud

import dk.sdu.cloud.auth.api.*
import dk.sdu.cloud.calls.client.OutgoingHttpCall
import dk.sdu.cloud.debug.DebugSystem
import dk.sdu.cloud.file.ucloud.rpc.FileCollectionsController
import dk.sdu.cloud.file.ucloud.rpc.FilesController
import dk.sdu.cloud.file.ucloud.rpc.SyncController
import dk.sdu.cloud.file.ucloud.rpc.ShareController
import dk.sdu.cloud.file.ucloud.services.*
import dk.sdu.cloud.file.ucloud.services.tasks.*
import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.calls.*
import dk.sdu.cloud.calls.server.RpcServer
import dk.sdu.cloud.micro.*
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.async.AsyncDBSessionFactory
import dk.sdu.cloud.service.TokenValidationChain
import dk.sdu.cloud.Roles
import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.calls.client.orThrow
import dk.sdu.cloud.sync.mounter.api.Mounts
import io.ktor.http.*
import java.io.File
import kotlin.system.exitProcess
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicLong

// NOTE(Dan): This is only used in development mode
object Scans : CallDescriptionContainer("file.ucloud.scans") {
    const val baseContext = "/api/file/ucloud/scans"

    val start = call<Unit, Unit, CommonErrorMessage>("start") {
        httpUpdate(baseContext, "start", roles = Roles.PUBLIC)
    }
}

class Server(
    override val micro: Micro,
    private val configuration: Configuration,
    private val cephConfig: CephConfiguration,
    private val syncConfig: SyncConfiguration,
    private val syncMounterSharedSecret: String?
) : CommonServer {
    override val log = logger()
    private val lastWrite = AtomicLong(Time.now())

    @OptIn(ExperimentalStdlibApi::class)
    override fun start() {
        val (refreshToken, validation) =
            if (configuration.providerRefreshToken == null || configuration.ucloudCertificate == null) {
                throw IllegalStateException("Missing configuration at files.ucloud.providerRefreshToken")
            } else {
                Pair(
                    configuration.providerRefreshToken,
                    InternalTokenValidationJWT.withPublicCertificate(configuration.ucloudCertificate)
                )
            }

        val authenticator = RefreshingJWTAuthenticator(micro.client, JwtRefresher.Provider(refreshToken))
        val internalAuthenticator = RefreshingJWTAuthenticator(
            micro.client,
            JwtRefresherSharedSecret(syncMounterSharedSecret ?: "this_will_fail")
        )
        @Suppress("UNCHECKED_CAST")
        micro.providerTokenValidation = TokenValidationChain(
            buildList {
                add(validation as TokenValidation<Any>)
                if (syncMounterSharedSecret != null) {
                    InternalTokenValidationJWT.withSharedSecret(syncMounterSharedSecret)
                } else {
                    log.warn("Missing shared secret for file-ucloud-service and sync-mounter. Sync will not work")
                }
            }
        )
        val authenticatedClient = authenticator.authenticateClient(OutgoingHttpCall)
        val db = AsyncDBSessionFactory(micro)

        val fsRootFile =
            File((cephConfig.cephfsBaseMount ?: "/mnt/cephfs/") + cephConfig.subfolder).takeIf { it.exists() }
                ?: if (micro.developmentModeEnabled) File("./fs") else throw IllegalStateException("No mount found!")

        val pathConverter = PathConverter(InternalFile(fsRootFile.absolutePath), authenticatedClient)
        val nativeFs = NativeFS(pathConverter, micro)
        val cephStats = CephFsFastDirectoryStats(nativeFs)

        val limitChecker = LimitChecker(db)
        val usageScan = UsageScan(pathConverter, nativeFs, cephStats, authenticatedClient, db)
        if (micro.commandLineArguments.contains("--scan-accounting")) {
            try {
                runBlocking {
                    usageScan.startScan()
                    exitProcess(0)
                }
            } catch (ex: Throwable) {
                log.warn(ex.stackTraceToString())
                exitProcess(1)
            }
        }

        val distributedStateFactory = RedisDistributedStateFactory(micro)
        val trashService = TrashService(pathConverter)
        val fileQueries = FileQueries(pathConverter, distributedStateFactory, nativeFs, trashService, cephStats)
        val chunkedUploadService = ChunkedUploadService(db, pathConverter, nativeFs)
        val downloadService = DownloadService(db, pathConverter, nativeFs)
        val memberFiles = MemberFiles(nativeFs, pathConverter, authenticatedClient)
        val distributedLocks = DistributedLockBestEffortFactory(micro)
        val syncthingClient = SyncthingClient(syncConfig, db, distributedLocks, lastWrite)
        val syncService =
            SyncService(syncthingClient, db, authenticatedClient, cephStats, pathConverter)

        val shareService = ShareService(nativeFs, pathConverter, authenticatedClient)
        val taskSystem = TaskSystem(db, pathConverter, nativeFs, micro.backgroundScope, authenticatedClient,
            micro.feature(DebugSystem)).apply {
            install(CopyTask())
            install(DeleteTask())
            install(MoveTask())
            install(CreateFolderTask())
            install(TrashTask(memberFiles, trashService))
            install(EmptyTrashTask())
        }
        val fileCollectionService = FileCollectionsService(
            pathConverter,
            db,
            taskSystem,
            nativeFs
        )

        taskSystem.launchScheduler(micro.backgroundScope)

//        useTestingSizes = micro.developmentModeEnabled

        configureControllers(
            FilesController(fileQueries, taskSystem, chunkedUploadService, downloadService, limitChecker),
            FileCollectionsController(fileCollectionService),
            SyncController(syncService),
            ShareController(shareService),
            object : Controller {
                override fun configure(rpcServer: RpcServer) {
                    if (micro.developmentModeEnabled) {
                        rpcServer.implement(Scans.start) {
                            GlobalScope.launch {
                                usageScan.startScan()
                            }
                            ok(Unit)
                        }
                    }
                }
            }
        )

        Runtime.getRuntime().addShutdownHook(Thread {
            runBlocking {
                syncthingClient.drainConfig()
            }
        })

        startServices()
    }

    override fun onKtorReady() {
        runBlocking {
            try {
                val running: List<LocalSyncthingDevice> = syncConfig.devices.mapNotNull { device ->
                    val client = micro.authenticator.authenticateClient(OutgoingHttpCall)
                    var foldersMounted = false
                    var retryCount = 0

                    while (!foldersMounted && retryCount < 5) {
                        delay(1000L)
                        retryCount += 1

                        val ready = Mounts.ready.call(
                            Unit,
                            client
                            //client.withMounterInfo(device)
                        )

                        if (ready.statusCode == HttpStatusCode.OK) {
                            if (ready.orThrow().ready) {
                                foldersMounted = true
                            }
                        }
                    }

                    if (foldersMounted) {
                        device
                    } else {
                        null
                    }
                }

                val db = AsyncDBSessionFactory(micro.databaseConfig)
                val distributedLocks = DistributedLockBestEffortFactory(micro)
                val syncthingClient = SyncthingClient(syncConfig, db, distributedLocks, lastWrite)
                syncthingClient.writeConfig(running)
                syncthingClient.rescan(running)
            } catch (ex: Throwable) {
                log.warn("Caught exception while trying to configure sync-thing (is it running?)")
                log.warn(ex.stackTraceToString())
            }
        }
    }
}

