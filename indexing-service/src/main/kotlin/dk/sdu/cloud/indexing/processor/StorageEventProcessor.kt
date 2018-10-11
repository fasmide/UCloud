package dk.sdu.cloud.indexing.processor

import dk.sdu.cloud.indexing.services.IndexingService
import dk.sdu.cloud.service.*
import dk.sdu.cloud.file.api.StorageEvents
import org.slf4j.Logger

class StorageEventProcessor(
    private val streamFactory: EventConsumerFactory,
    private val indexingService: IndexingService,
    private val parallelism: Int = 4
) {
    fun init(): List<EventConsumer<*>> {
        return (0 until parallelism).map { _ ->
            streamFactory.createConsumer(StorageEvents.events).configure { root ->
                root
                    .batched(
                        batchTimeout = 500,
                        maxBatchSize = 1000
                    )
                    .consumeBatchAndCommit { batch ->
                        log.debug("Handling another batch of ${batch.size} files. Head of batch: " +
                                "${batch.asSequence().take(5).map { it.second.path }.toList()}...")

                        indexingService.bulkHandleEvent(batch.map { it.second })

                        log.debug("Batch complete")
                    }
            }
        }
    }

    companion object : Loggable {
        override val log: Logger = logger()
    }
}
