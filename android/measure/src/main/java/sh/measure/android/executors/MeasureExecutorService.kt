package sh.measure.android.executors

import org.jetbrains.annotations.TestOnly
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit

internal interface MeasureExecutorService {
    @Throws(RejectedExecutionException::class)
    fun <T> submit(callable: Callable<T>): Future<T>

    @Throws(RejectedExecutionException::class)
    fun <T> schedule(callable: Callable<T>, delayMillis: Long): Future<T>

    @Throws(RejectedExecutionException::class)
    fun scheduleAtFixedRate(
        runnable: Runnable,
        initialDelay: Long,
        delayMillis: Long,
        delayUnit: TimeUnit,
    ): Future<*>

    fun shutdown()
}

internal class MeasureExecutorServiceImpl @TestOnly constructor(private val executorService: ScheduledExecutorService) : MeasureExecutorService {

    constructor(threadFactory: ThreadFactory) : this(
        Executors.newSingleThreadScheduledExecutor(threadFactory),
    )

    override fun <T> submit(callable: Callable<T>): Future<T> = executorService.submit(callable)

    override fun <T> schedule(callable: Callable<T>, delayMillis: Long): Future<T> = executorService.schedule(callable, delayMillis, TimeUnit.MILLISECONDS)

    override fun scheduleAtFixedRate(
        runnable: Runnable,
        initialDelay: Long,
        delayMillis: Long,
        delayUnit: TimeUnit,
    ): Future<*> = executorService.scheduleWithFixedDelay(
        runnable,
        initialDelay,
        delayMillis,
        delayUnit,
    )

    override fun shutdown() {
        executorService.shutdown()
        try {
            executorService.awaitTermination(30, TimeUnit.SECONDS)
        } catch (ie: InterruptedException) {
            // ignore interrupted exceptions
        }
    }
}
