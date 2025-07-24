package sh.measure.android.executors

import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory

/**
 * A central registry to create and manage executor services created across Measure SDK.
 */
internal interface ExecutorServiceRegistry {
    /**
     * An executor service dedicated to long running background tasks. Example a database
     * query or a disk read/write, etc. For exporting data to network, use [eventExportExecutor].
     */
    fun ioExecutor(): MeasureExecutorService

    /**
     * Returns an executor service dedicated to exporting events to network.
     */
    fun eventExportExecutor(): MeasureExecutorService

    /**
     * An executor for running short lived tasks. Example: processing an event.
     */
    fun defaultExecutor(): MeasureExecutorService
}

internal class ExecutorServiceRegistryImpl : ExecutorServiceRegistry {
    private val executors: MutableMap<ExecutorServiceName, MeasureExecutorService> by lazy { mutableMapOf() }

    override fun ioExecutor(): MeasureExecutorService = executors.getOrPut(ExecutorServiceName.IOExecutor) {
        val threadFactory = namedThreadFactory("msr-io")
        MeasureExecutorServiceImpl(threadFactory)
    }

    override fun defaultExecutor(): MeasureExecutorService = executors.getOrPut(ExecutorServiceName.DefaultExecutor) {
        val threadFactory = namedThreadFactory("msr-default")
        MeasureExecutorServiceImpl(threadFactory)
    }

    override fun eventExportExecutor(): MeasureExecutorService = executors.getOrPut(ExecutorServiceName.ExportExecutor) {
        val threadFactory = namedThreadFactory("msr-export")
        MeasureExecutorServiceImpl(threadFactory)
    }

    private fun namedThreadFactory(threadName: String) = ThreadFactory { runnable: Runnable ->
        Executors.defaultThreadFactory().newThread(runnable).apply {
            this.name = threadName
        }
    }
}

private enum class ExecutorServiceName {
    IOExecutor,
    DefaultExecutor,
    ExportExecutor,
}
