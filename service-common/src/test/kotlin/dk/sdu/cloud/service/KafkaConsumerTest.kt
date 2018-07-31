package dk.sdu.cloud.service

import dk.sdu.cloud.client.ServiceDescription
import kotlinx.coroutines.experimental.delay
import kotlinx.coroutines.experimental.launch
import kotlinx.coroutines.experimental.runBlocking
import org.junit.Test
import kotlin.test.assertEquals

class KafkaConsumerTest {
    private val kafkaService = KafkaUtil.createKafkaServices(
        object : ServerConfiguration {
            override val connConfig: ConnectionConfig = ConnectionConfig(
                kafka = KafkaConnectionConfig(
                    listOf(KafkaHostConfig("localhost"))
                ),

                service = ServiceConnectionConfig(
                    description = object : ServiceDescription {
                        override val name: String = "kafka-consumer-test"
                        override val version: String = "1.0.0"
                    },
                    hostname = "localhost",
                    port = -1
                ),

                database = null
            )

            override fun configure() {
                // Do nothing
            }
        },

        createAdminClient = true
    )

    private val adminClient = kafkaService.adminClient!!

    private data class Advanced(
        val id: Int,
        val foo: Pair<String, Int>
    )

    private object Descriptions : KafkaDescriptions() {
        val testStream = stream<String, Advanced>("kafka-consumer-test-stream") { it.id.toString() }
    }

    @Test
    fun testSimpleConsumption() {
        /*
        try {
            adminClient.deleteTopics(listOf(Descriptions.testStream.name)).all().get()
        } catch (ex: Exception) {
            ex.printStackTrace()
        }
        adminClient.createTopics(listOf(NewTopic(Descriptions.testStream.name, 1, 1))).all().get()
        */

        val producer = kafkaService.producer.forStream(Descriptions.testStream)
        val consumedItems = Array(16) { ArrayList<Pair<String, Advanced>>() }
        val consumers = (0 until 16).map { id ->
            val start = System.currentTimeMillis()
            var lastTimer = System.currentTimeMillis()
            fun timeSinceStart(): Long =
                (System.currentTimeMillis() - start).also { lastTimer = System.currentTimeMillis() }

            fun delta(): Long = System.currentTimeMillis() - lastTimer

            kafkaService.createConsumer(Descriptions.testStream).configure { root ->
                root
                    .batched(batchTimeout = 100, maxBatchSize = 10)
                    .consumeBatchAndCommit {
                        println("[$id] Consumed ${it.size} items. ${delta()} since last. ${timeSinceStart()} ms after start")
                        consumedItems[id].addAll(it)
                    }
            }
        }

        val producerJob = launch {
            delay(2000)

            repeat(1000) {
                producer.emit(
                    Advanced(
                        it,
                        "hello" to 42
                    )
                )
            }
        }
        runBlocking { producerJob.join() }

        Thread.sleep(10000)
        consumers.forEach { it.close() }

        println(consumedItems)
        assertEquals(
            1000,
            // We have at-least-once delivery. But we still want to make sure all of them are actually delivered
            consumedItems.flatMap { it }.associateBy { it.first }.values.size
        )
    }
}