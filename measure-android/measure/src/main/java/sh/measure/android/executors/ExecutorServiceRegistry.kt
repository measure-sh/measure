package sh.measure.android.executors

import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory

/**
 * A central registry to create and manage executor services created across Measure SDK.
 */
internal interface ExecutorServiceRegistry {
    /**
     * Returns an executor service which can be used to schedule background jobs.
     */
    fun backgroundExecutor(): MeasureExecutorService

    /**
     * Returns an executor service dedicated to process events.
     */
    fun eventProcessorExecutor(): MeasureExecutorService

    /**
     * Returns an executor service dedicated to exporting events to network.
     */
    fun eventExportExecutor(): MeasureExecutorService

    /**
     * Returns an executor service to schedule CPU and memory usage collection.
     */
    fun cpuAndMemoryCollectionExecutor(): MeasureExecutorService

    /**
     * Returns an executor service to schedule a heartbeat for exporting events.
     */
    fun exportHeartbeatExecutor(): MeasureExecutorService
}

internal class ExecutorServiceRegistryImpl : ExecutorServiceRegistry {
    private val executors: MutableMap<ExecutorServiceName, MeasureExecutorService> by lazy { mutableMapOf() }

    override fun backgroundExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.AppExitCollection) {
            val threadFactory = namedThreadFactory("msr-bg")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    override fun eventProcessorExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.EventIngestion) {
            val threadFactory = namedThreadFactory("msr-ep")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    override fun eventExportExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.EventExport) {
            val threadFactory = namedThreadFactory("msr-ee")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    override fun cpuAndMemoryCollectionExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.CpuMemoryUsageCollection) {
            val threadFactory = namedThreadFactory("msr-cmu")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    override fun exportHeartbeatExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.ExportHeartbeat) {
            val threadFactory = namedThreadFactory("msr-eh")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    private fun namedThreadFactory(threadName: String) = ThreadFactory { runnable: Runnable ->
        Executors.defaultThreadFactory().newThread(runnable).apply {
            this.name = threadName
        }
    }
}

private enum class ExecutorServiceName {
    AppExitCollection,
    EventIngestion,
    EventExport,
    CpuMemoryUsageCollection,
    ExportHeartbeat,
}
