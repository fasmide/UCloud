package dk.sdu.cloud.indexing.processor

import dk.sdu.cloud.file.api.StorageEvent
import dk.sdu.cloud.file.api.StorageEvents
import dk.sdu.cloud.indexing.services.IndexingService
import dk.sdu.cloud.service.EventConsumer
import dk.sdu.cloud.service.EventConsumerFactory
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.batched
import dk.sdu.cloud.service.consumeBatchAndCommit
import org.slf4j.Logger

/**
 * Processes [StorageEvent]s
 *
 * @see IndexingService
 */
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
                        batchTimeout = BATCH_TIMEOUT_MS,
                        maxBatchSize = MAX_ITEMS_IN_BATCH
                    )
                    .consumeBatchAndCommit { batch ->
                        log.debug("Handling another batch of ${batch.size} files. Head of batch: " +
                                "${batch.asSequence().take(DEBUG_ELEMENTS_IN_LOG).map { it.second.path }.toList()}..."
                        )

                        indexingService.bulkHandleEvent(batch.map { it.second })

                        log.debug("Batch complete")
                    }
            }
        }
    }

    companion object : Loggable {
        override val log: Logger = logger()

        private const val BATCH_TIMEOUT_MS = 500L
        private const val MAX_ITEMS_IN_BATCH = 1000

        private const val DEBUG_ELEMENTS_IN_LOG = 5
    }
}
