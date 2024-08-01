package sh.measure.android.exporter

import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.RejectedExecutionException

/**
 * An interface which allows exporting events to server when an exception occurs.
 */
internal interface ExceptionExporter {
    fun export(sessionId: String)
}

/**
 * An implementation of [ExceptionExporter] that exports events to the server when an exception
 * causes the app to crash. This exporter assumes that the exception event has been written to
 * disk. It simply creates a creates and exports a new batch which contains all events that have
 * not been exported yet, including the exception.
 */
internal class ExceptionExporterImpl(
    private val logger: Logger,
    private val eventExporter: EventExporter,
    private val exportExecutor: MeasureExecutorService,
) : ExceptionExporter {
    override fun export(sessionId: String) {
        try {
            exportExecutor.submit {
                eventExporter.createBatch(sessionId)?.let {
                    eventExporter.export(it.batchId, it.eventIds)
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Failed to submit exception export task to executor", e)
        }
    }
}
