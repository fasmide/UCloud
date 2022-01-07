package dk.sdu.cloud.plugins.storage.posix

import dk.sdu.cloud.PageV2
import dk.sdu.cloud.ProductBasedConfiguration
import dk.sdu.cloud.accounting.api.ProductReference
import dk.sdu.cloud.calls.BulkResponse
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.file.orchestrator.api.*
import dk.sdu.cloud.plugins.FilePlugin
import dk.sdu.cloud.plugins.PluginContext
import dk.sdu.cloud.plugins.storage.InternalFile
import dk.sdu.cloud.plugins.storage.PathConverter
import dk.sdu.cloud.plugins.storage.UCloudFile
import dk.sdu.cloud.utils.NativeFile
import dk.sdu.cloud.utils.NativeFileException
import io.ktor.http.*
import kotlinx.cinterop.*
import platform.posix.closedir
import platform.posix.fdopendir
import platform.posix.readdir
import platform.posix.stat

class PosixFilesPlugin : FilePlugin {
    private lateinit var pathConverter: PathConverter

    override suspend fun PluginContext.initialize(pluginConfig: ProductBasedConfiguration) {
        pathConverter = PathConverter(this)
    }

    override suspend fun PluginContext.browse(
        path: UCloudFile,
        request: FilesProviderBrowseRequest
    ): PageV2<PartialUFile> {
        val internalFile = pathConverter.ucloudToInternal(path)
        val openedDirectory = try {
            NativeFile.open(internalFile.path, readOnly = true, createIfNeeded = false)
        } catch (ex: NativeFileException) {
            throw RPCException("File not found", HttpStatusCode.NotFound)
        }
        try {
            val dir = fdopendir(openedDirectory.fd)
                ?: throw RPCException("File is not a directory", HttpStatusCode.Conflict)

            val result = ArrayList<PartialUFile>()
            while (true) {
                val ent = readdir(dir) ?: break
                val name = ent.pointed.d_name.toKString()
                if (name == "." || name == "..") continue
                runCatching {
                    // NOTE(Dan): Ignore errors, in case the file is being changed while we inspect it
                    result.add(nativeStat(InternalFile(internalFile.path + "/" + name)))
                }
            }
            closedir(dir)

            return PageV2(result.size, result, null)
        } finally {
            openedDirectory.close()
        }
    }

    private fun nativeStat(file: InternalFile): PartialUFile {
        return memScoped {
            val st = alloc<stat>()
            val error = stat(file.path, st.ptr)
            if (error < 0) {
                // TODO actually remap the error code
                throw RPCException("Could not open file", HttpStatusCode.NotFound)
            }

            val modifiedAt = (st.st_mtim.tv_sec * 1000) + (st.st_mtim.tv_nsec / 1_000_000)
            PartialUFile(
                pathConverter.internalToUCloud(file).path,
                UFileStatus(
                    if (st.st_mode and S_ISREG == 0U) FileType.DIRECTORY else FileType.FILE,
                    sizeInBytes = st.st_size,
                    modifiedAt = modifiedAt,
                    unixOwner = st.st_uid.toInt(),
                    unixGroup = st.st_gid.toInt(),
                    unixMode = st.st_mode.toInt(),
                ),
                modifiedAt
            )
        }
    }

    override suspend fun PluginContext.retrieve(request: FilesProviderRetrieveRequest): PartialUFile {
        return nativeStat(pathConverter.ucloudToInternal(UCloudFile.create(request.retrieve.id)))
    }

    override suspend fun PluginContext.delete(resource: UFile) {
        TODO("Not yet implemented")
    }

    override suspend fun PluginContext.retrieveProducts(
        knownProducts: List<ProductReference>
    ): BulkResponse<FSSupport> {
        return BulkResponse(knownProducts.map {
            FSSupport(
                it,
                FSProductStatsSupport(),
                FSCollectionSupport(),
                FSFileSupport()
            )
        })
    }

    companion object {
        private const val S_ISREG = 0x8000U
    }
}