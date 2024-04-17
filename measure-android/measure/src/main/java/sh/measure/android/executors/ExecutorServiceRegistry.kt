package sh.measure.android.executors

import sh.measure.android.events.EventProcessor
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory

internal interface ExecutorServiceRegistry {
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

internal class ExecutorServiceRegistryImpl: ExecutorServiceRegistry {
    private val executors: MutableMap<ExecutorServiceName, MeasureExecutorService> by lazy { mutableMapOf() }

    override fun eventProcessorExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.EventIngestion) {
            val threadFactory = namedThreadFactory("msr-event-processor")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    override fun eventExportExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.EventExport) {
            val threadFactory = namedThreadFactory("msr-event-export")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    override fun cpuAndMemoryCollectionExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.CpuMemoryUsageCollection) {
            val threadFactory = namedThreadFactory("msr-cpu-mem-usage")
            MeasureExecutorServiceImpl(threadFactory)
        }
    }

    override fun exportHeartbeatExecutor(): MeasureExecutorService {
        return executors.getOrPut(ExecutorServiceName.ExportHeartbeat) {
            val threadFactory = namedThreadFactory("msr-export-heartbeat")
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
    EventIngestion,
    EventExport,
    CpuMemoryUsageCollection,
    ExportHeartbeat
}