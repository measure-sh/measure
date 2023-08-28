package sh.measure.android.events.sinks

import sh.measure.android.database.DbClient
import sh.measure.android.events.MeasureEvent
import sh.measure.android.logger.Logger
import java.util.concurrent.Executors

/**
 * A sink that writes events to a database using [DbClient].
 *
 * @param logger The logger to use for logging.
 * @param dbClient The database client to use for writing events.
 */
internal class DbSink(private val logger: Logger, private val dbClient: DbClient) : Sink {
    private val executor = Executors.newSingleThreadExecutor()

    override fun offer(event: MeasureEvent, immediate: Boolean) {
        if (immediate) {
            dbClient.insertEvent(event)
        } else {
            executor.submit {
                dbClient.insertEvent(event)
            }
        }
    }
}