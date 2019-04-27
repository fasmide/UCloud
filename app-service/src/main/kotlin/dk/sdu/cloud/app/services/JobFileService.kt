package dk.sdu.cloud.app.services

import dk.sdu.cloud.app.api.ComputationDescriptions
import dk.sdu.cloud.app.api.SubmitFileToComputation
import dk.sdu.cloud.app.api.VerifiedJob
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.calls.client.*
import dk.sdu.cloud.calls.types.BinaryStream
import dk.sdu.cloud.file.api.*
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.stackTraceToString
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.defaultForFilePath
import io.ktor.http.isSuccess
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.io.ByteReadChannel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.*

class JobFileService(
    private val serviceClient: AuthenticatedClient
) {
    private fun AuthenticatedClient.bearerAuth(token: String): AuthenticatedClient {
        return ClientAndBackend(client, companion).bearerAuth(token)
    }

    suspend fun initializeResultFolder(
        jobWithToken: VerifiedJobWithAccessToken,
        isReplay: Boolean = false
    ) {
        val (job, accessToken) = jobWithToken

        val userCloud = serviceClient.bearerAuth(accessToken)

        val path = jobFolder(job)
        FileDescriptions.createDirectory.call(
            CreateDirectoryRequest(path.parent(), null),
            userCloud
        )

        val dirResp = FileDescriptions.createDirectory.call(
            CreateDirectoryRequest(path, null),
            userCloud
        ).throwIfInternal()

        if (!dirResp.statusCode.isSuccess()) {
            // We allow conflicts during replay
            if (isReplay && dirResp.statusCode == HttpStatusCode.Conflict) return

            // Throw if we didn't allow this case
            throw RPCException.fromStatusCode(dirResp.statusCode)
        }
    }

    suspend fun acceptFile(
        jobWithToken: VerifiedJobWithAccessToken,

        filePath: String,
        length: Long,
        fileData: ByteReadChannel,
        needsExtraction: Boolean
    ) {
        log.debug("Accepting file at $filePath for ${jobWithToken.job.id}")

        val parsedFilePath = File(filePath)
        val relativePath = if (parsedFilePath.isAbsolute) {
            ".$filePath" // TODO This might be a bad idea
        } else {
            filePath
        }

        log.debug("The relative path is $relativePath")

        val rootDestination = File(jobFolder(jobWithToken.job))
        val destPath = File(rootDestination, relativePath)

        log.debug("The destination path is ${destPath.path}")

        val sensitivityLevel =
            jobWithToken.job.files.map { it.stat.sensitivityLevel }.sortedByDescending { it.ordinal }.max()
                ?: SensitivityLevel.PRIVATE

        val (_, accessToken) = jobWithToken
        MultiPartUploadDescriptions.simpleUpload.call(
            SimpleUploadRequest(
                location = destPath.path,
                sensitivity = sensitivityLevel,
                file = BinaryStream.outgoingFromChannel(
                    fileData,
                    contentLength = length,
                    contentType = ContentType.defaultForFilePath(filePath)
                )
            ),
            serviceClient.bearerAuth(accessToken)
        ).orThrow()

        if (needsExtraction) {
            FileDescriptions.extract.call(
                ExtractRequest(
                    destPath.path,
                    removeOriginalArchive = true
                ),
                serviceClient.bearerAuth(accessToken)
            ).orThrow()
        }
    }

    private val jobFolderCache = HashMap<String, String>()
    private val jobFolderLock = Mutex()

    suspend fun jobFolder(job: VerifiedJob): String {
        jobFolderLock.withLock {
            val cached = jobFolderCache[job.owner]
            if (cached != null) return cached
            val homeFolder = FileDescriptions.findHomeFolder.call(
                FindHomeFolderRequest(job.owner),
                serviceClient
            ).orThrow().path

            return joinPath(
                homeFolder,
                "Jobs",
                job.archiveInCollection,
                timestampFormatter.format(LocalDateTime.ofInstant(Date(job.createdAt).toInstant(), zoneId))
            ).also { jobFolderCache[job.owner] = it }
        }
    }

    suspend fun transferFilesToBackend(jobWithToken: VerifiedJobWithAccessToken, backend: ComputationDescriptions) {
        val (job, accessToken) = jobWithToken
        coroutineScope {
            job.files.map { file ->
                async {
                    runCatching {
                        val userCloud = serviceClient.withoutAuthentication().bearerAuth(accessToken)
                        val fileStream = FileDescriptions.download.call(
                            DownloadByURI(file.sourcePath, null),
                            userCloud
                        ).orRethrowAs { throw JobException.TransferError() }.asIngoing()

                        backend.submitFile.call(
                            SubmitFileToComputation(
                                job.id,
                                file.id,
                                BinaryStream.outgoingFromChannel(
                                    fileStream.channel,
                                    contentType = fileStream.contentType
                                        ?: ContentType.Application.OctetStream,
                                    contentLength = fileStream.length
                                )
                            ),
                            serviceClient
                        ).orThrow()
                    }
                }
            }.awaitAll().firstOrNull { it.isFailure }.let {
                if (it != null) {
                    throw it.exceptionOrNull()!!
                }
            }
        }
    }

    suspend fun createWorkspace(jobWithToken: VerifiedJobWithAccessToken): String {
        val (job, _) = jobWithToken
        val mounts = job.files.map { file ->
            WorkspaceMount(file.sourcePath, file.destinationPath)
        }

        return WORKSPACE_PATH + WorkspaceDescriptions.create.call(
            WorkspaceDescriptions.Create.Request(mounts, allowFailures = false),
            serviceClient
        ).orThrow().workspaceId
    }

    suspend fun transferWorkspace(
        jobWithToken: VerifiedJobWithAccessToken,
        replay: Boolean
    ) {
        val (job, _) = jobWithToken
        try {
            WorkspaceDescriptions.transfer.call(
                WorkspaceDescriptions.Transfer.Request(
                    workspaceId = job.workspace?.removePrefix(WORKSPACE_PATH) ?: throw RPCException(
                        "No workspace found",
                        HttpStatusCode.InternalServerError
                    ),
                    transferGlobs = job.application.invocation.outputFileGlobs,
                    destination = jobFolder(job),
                    deleteWorkspace = true
                ),
                serviceClient
            ).orThrow()
        } catch (ex: Throwable) {
            if (replay) {
                log.info("caught exception while replaying transfer of workspace. ${ex.message}")
                log.debug(ex.stackTraceToString())
            } else {
                throw ex
            }
        }
    }

    companion object : Loggable {
        override val log = logger()

        private val zoneId = ZoneId.of("Europe/Copenhagen")
        private val timestampFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss.SSS")
        private const val WORKSPACE_PATH = "/workspace/"
    }
}
