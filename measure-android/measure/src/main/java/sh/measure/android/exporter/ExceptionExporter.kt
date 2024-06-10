package sh.measure.android.exporter

import sh.measure.android.executors.MeasureExecutorService

/**
 * An interface which allows exporting events to server when an exception occurs.
 */
internal interface ExceptionExporter {
    fun export()
}

/**
 * An implementation of [ExceptionExporter] that exports events to the server when an exception
 * causes the app to crash. This exporter assumes that the exception event has been written to
 * disk. It simply creates a creates and exports a new batch which contains all events that have
 * not been exported yet, including the exception.
 */
internal class ExceptionExporterImpl(
    private val eventExporter: EventExporter,
    private val executorService: MeasureExecutorService,
) : ExceptionExporter {
    override fun export() {
        executorService.submit {
            eventExporter.createBatch()?.let {
                eventExporter.export(it.batchId, it.eventIds)
            }
        }
    }
}
