package sh.measure.android.executors

import org.jetbrains.annotations.TestOnly
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit

internal interface MeasureExecutorService {
    fun submit(runnable: Runnable): Future<*>
    fun schedule(runnable: Runnable, delayMillis: Long): Future<*>
    fun scheduleAtFixedRate(
        runnable: Runnable,
        initialDelay: Long,
        delayMillis: Long,
        delayUnit: TimeUnit,
    ): Future<*>
}

internal class MeasureExecutorServiceImpl @TestOnly constructor(private val executorService: ScheduledExecutorService) :
    MeasureExecutorService {

    constructor(threadFactory: ThreadFactory) : this(
        Executors.newSingleThreadScheduledExecutor(threadFactory),
    )

    override fun submit(runnable: Runnable): Future<*> {
        return executorService.submit(runnable)
    }

    override fun schedule(runnable: Runnable, delayMillis: Long): Future<*> {
        return executorService.schedule(runnable, delayMillis, TimeUnit.MILLISECONDS)
    }

    override fun scheduleAtFixedRate(
        runnable: Runnable,
        initialDelay: Long,
        delayMillis: Long,
        delayUnit: TimeUnit,
    ): Future<*> {
        return executorService.scheduleWithFixedDelay(runnable, initialDelay, delayMillis, delayUnit)
    }
}
