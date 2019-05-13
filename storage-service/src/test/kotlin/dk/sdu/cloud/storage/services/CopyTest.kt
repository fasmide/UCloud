package dk.sdu.cloud.storage.services

import dk.sdu.cloud.file.api.StorageEvents
import dk.sdu.cloud.file.api.WriteConflictPolicy
import dk.sdu.cloud.file.api.fileName
import dk.sdu.cloud.file.services.*
import dk.sdu.cloud.file.services.linuxfs.LinuxFSRunner
import dk.sdu.cloud.file.services.linuxfs.LinuxFSRunnerFactory
import dk.sdu.cloud.service.test.EventServiceMock
import dk.sdu.cloud.service.test.assertThatInstance
import dk.sdu.cloud.storage.util.linuxFSWithRelaxedMocks
import dk.sdu.cloud.storage.util.mkdir
import dk.sdu.cloud.storage.util.touch
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals

class CopyTest {
    val user = "user"

    data class TestContext(
        val runner: LinuxFSRunnerFactory,
        val fs: LowLevelFileSystemInterface<LinuxFSRunner>,
        val coreFs: CoreFileSystemService<LinuxFSRunner>,
        val sensitivityService: FileSensitivityService<LinuxFSRunner>,
        val lookupService: FileLookupService<LinuxFSRunner>
    )

    private fun initTest(root: File): TestContext {
        BackgroundScope.init()

        val (runner, fs) = linuxFSWithRelaxedMocks(root.absolutePath)
        val storageEventProducer = StorageEventProducer(EventServiceMock.createProducer(StorageEvents.events), {})
        val sensitivityService =
            FileSensitivityService(fs, storageEventProducer)
        val coreFs = CoreFileSystemService(fs, storageEventProducer)
        val fileLookupService = FileLookupService(coreFs)

        return TestContext(runner, fs, coreFs, sensitivityService, fileLookupService)
    }

    private fun createRoot(): File = Files.createTempDirectory("sensitivity-test").toFile()

    @Test
    fun `test copying a folder`() {
        val root = createRoot()
        with(initTest(root)) {
            root.mkdir("home") {
                mkdir("user") {
                    mkdir("folder") {
                        touch("1")
                        touch("2")
                        mkdir("subfolder") {
                            touch("a")
                            touch("b")
                        }
                    }
                }
            }

            runner.withBlockingContext(user) { ctx ->
                coreFs.copy(ctx, "/home/user/folder", "/home/user/folder2", WriteConflictPolicy.REJECT)
                val mode = setOf(FileAttribute.PATH, FileAttribute.FILE_TYPE)
                val listing =
                    coreFs.listDirectory(ctx, "/home/user/folder2", mode)

                assertEquals(3, listing.size)
                assertThatInstance(listing) { it.any { it.path.fileName() == "1" } }
                assertThatInstance(listing) { it.any { it.path.fileName() == "2" } }
                assertThatInstance(listing) { it.any { it.path.fileName() == "subfolder" } }

                val sublisting = coreFs.listDirectory(ctx, "/home/user/folder2/subfolder", mode)
                assertEquals(2, sublisting.size)
                assertThatInstance(sublisting) { it.any { it.path.fileName() == "a" } }
                assertThatInstance(sublisting) { it.any { it.path.fileName() == "b" } }
            }
        }
    }

    @Test
    fun `test copying a folder (rename)`() {
        val root = createRoot()
        with(initTest(root)) {
            root.mkdir("home") {
                mkdir("user") {
                    mkdir("folder") {
                        touch("1")
                        touch("2")
                        mkdir("subfolder") {
                            touch("a")
                            touch("b")
                        }
                    }
                }
            }

            runner.withBlockingContext(user) { ctx ->
                coreFs.copy(ctx, "/home/user/folder", "/home/user/folder", WriteConflictPolicy.RENAME)
                val mode = setOf(FileAttribute.PATH, FileAttribute.FILE_TYPE)

                val rootListing = coreFs.listDirectory(ctx, "/home/user", mode)
                assertEquals(2, rootListing.size)
                assertThatInstance(rootListing) { it.any { it.path.fileName() == "folder" } }
                assertThatInstance(rootListing) { it.any { it.path.fileName() == "folder(1)" } }

                val listing =
                    coreFs.listDirectory(ctx, "/home/user/folder(1)", mode)

                assertEquals(3, listing.size)
                assertThatInstance(listing) { it.any { it.path.fileName() == "1" } }
                assertThatInstance(listing) { it.any { it.path.fileName() == "2" } }
                assertThatInstance(listing) { it.any { it.path.fileName() == "subfolder" } }

                val sublisting = coreFs.listDirectory(ctx, "/home/user/folder(1)/subfolder", mode)
                assertEquals(2, sublisting.size)
                assertThatInstance(sublisting) { it.any { it.path.fileName() == "a" } }
                assertThatInstance(sublisting) { it.any { it.path.fileName() == "b" } }
            }
        }
    }
}