package sh.measure.android.events.sinks

import sh.measure.android.database.DbClient
import sh.measure.android.events.MeasureEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.network.HttpCallback
import sh.measure.android.network.HttpClient
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors

private const val BATCH_SIZE = 5
private const val QUEUE_CAPACITY = BATCH_SIZE * 3

/**
 * A sink that sends data to server in batches using a [HttpClient]. This sink is thread-safe. It
 * uses a blocking queue to store events.
 *
 * TODO(abhay): the only reason to use a executor here to to run the db.insertEvent in a separate
 *  thread. The HTTP request is already done async by the HttpClient. We also have an executor
 *  created in DbSink. We can probably use a single executor for writing to db.  But sharing the
 *  executor between the two sinks is a bit problematic at the moment.
 *
 * @param logger The logger to use for logging
 * @param httpClient The HTTP client to use for sending data to the server.
 * @param dbClient The database client to use for marking data sent successfully in the database.
 */
internal class HttpSink(
    private val logger: Logger,
    private val httpClient: HttpClient,
    private val dbClient: DbClient
) : Sink {
    private val eventQueue = ArrayBlockingQueue<MeasureEvent>(QUEUE_CAPACITY)
    private val executor = Executors.newSingleThreadExecutor()

    override fun offer(event: MeasureEvent, immediate: Boolean) {
        try {
            eventQueue.put(event)
        } catch (e: InterruptedException) {
            logger.log(LogLevel.Error, "Interrupted while adding event queue", e)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to add event to queue", e)
        }

        if (immediate || eventQueue.size >= BATCH_SIZE) {
            flushBatch()
        }
    }

    private fun flushBatch() {
        executor.submit {
            val events = mutableListOf<MeasureEvent>()
            try {
                eventQueue.drainTo(events)
                val unSyncedEvents = dbClient.getUnSyncedEvents()
                events.addAll(unSyncedEvents)
            } catch (e: InterruptedException) {
                logger.log(LogLevel.Error, "Interrupted while draining event queue", e)
            } catch (e: Exception) {
                logger.log(LogLevel.Error, "Failed to drain event queue", e)
            }

            if (events.isNotEmpty()) {
                httpClient.sendEvents(events, object : HttpCallback {
                    override fun onSuccess() {
                        dbClient.deleteSyncedEvents(events.map { it.id })
                    }
                })
            }
        }
    }
}
