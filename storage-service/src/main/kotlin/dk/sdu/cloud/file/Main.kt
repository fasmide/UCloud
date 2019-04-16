package dk.sdu.cloud.file

import dk.sdu.cloud.auth.api.RefreshingJWTCloudFeature
import dk.sdu.cloud.micro.*
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.storage.api.StorageServiceDescription

val SERVICE_USER = "_${StorageServiceDescription.name}"
const val SERVICE_UNIX_USER = "storage" // Note: root is also supported. Should only be done in a container

data class StorageConfiguration(
    val filePermissionAcl: Set<String> = emptySet()
)

class Foo {
    companion object : Loggable {
        override val log = logger()
    }
}

fun main(args: Array<String>) {
    val micro = Micro().apply {
        init(StorageServiceDescription, args)
        installDefaultFeatures(
            kafkaTopicConfig = KafkaTopicFeatureConfiguration(
                discoverDefaults = true,
                basePackages = listOf("dk.sdu.cloud.file.api")
            )
        )
        install(HibernateFeature)
        install(RefreshingJWTCloudFeature)
    }

    if (micro.runScriptHandler()) return

    val config = micro.configuration.requestChunkAtOrNull("storage") ?: StorageConfiguration()

    Server(
        config,
        micro
    ).start()

    /*
    val userDao = object : StorageUserDao<Long> {
        private val map = mapOf<String, Long>(
            "dan" to 1001,
            "fie" to 1002,
            "alonzo" to 1003,
            SERVICE_USER to 0
        )

        override suspend fun findCloudUser(uid: Long, verify: Boolean): String? {
            return map.entries.find { it.value == uid }?.key
        }

        override suspend fun findStorageUser(cloudUser: String, verify: Boolean): Long? {
            return map[cloudUser]
        }

    }

    runBlocking {
        val fsRunnerFactory = LinuxFSRunnerFactory(userDao)
        val runner = fsRunnerFactory("dan")
        val fs = LinuxFS(fsRunnerFactory, File("/tmp/fs"), userDao)

        runner.use {
            /* val toString = LinuxFS::class.java.classLoader.getResource("libthreading.dylib").toURI().path
             println(toString)

             System.load(toString)*/
            for (a in 0..9) {
                NativeThread {
                    Thread.currentThread().name = "CanWeDoThis?$a"
                    repeat(60) {
                        println("HI!HI!")
                        println(Thread.currentThread().name)
                        println(Thread.currentThread().id)
                        Thread.sleep(1000)
                    }
                }.start()
            }
            /*
            fs.listDirectory(runner, "/home/dan", FileAttribute.values().toSet()).unwrap().forEach {
                println(it)
            }

            fs.createACLEntry(runner, "/home/dan/a", FSACLEntity.User("alonzo"), setOf(AccessRight.READ))
            fs.createACLEntry(
                runner,
                "/home/dan/a",
                FSACLEntity.User("fie"),
                setOf(AccessRight.READ),
                defaultList = true
            )

            fs.removeACLEntry(runner, "/home/dan/a", FSACLEntity.User("alonzo"))
            fs.removeACLEntry(runner, "/home/dan/a", FSACLEntity.User("fie"), defaultList = true)
            */

            /*StandardCLib.umask("0007".toInt(8))

            Foo.log.info(fs.openForWriting(runner, "/home/dan/file", true).unwrap().toString())
            Foo.log.info(fs.write(runner) {
                it.use {
                    it.write("Hello".toByteArray())
                }
            }.unwrap().toString())

            fs.openForReading(runner, "/home/dan/file").unwrap()
            fs.read(runner) {
                println(it.bufferedReader().readText())
            }

            fs.openForReading(runner, "/home/dan/file").unwrap()
            fs.read(runner, 0..1L) {
                println(it.bufferedReader().readText())
            }

            fs.openForReading(runner, "/home/dan/file").unwrap()
            fs.read(runner, 3..6L) {
                println(it.bufferedReader().readText())
            }

            fs.tree(runner, "/home/dan", FileAttribute.values().toSet()).unwrap().forEach {
                println(it)
            }

            repeat(10) { println() }
            fs.delete(runner, "/home/dan/a_directory").unwrap().forEach {
                println(it)
            }*/
        }
    }
    */
}
