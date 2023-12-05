package sh.measure.android.fakes

import androidx.concurrent.futures.DirectExecutor
import androidx.concurrent.futures.ResolvableFuture
import sh.measure.android.executors.MeasureExecutorService
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

/**
 * A [MeasureExecutorService] which executes all tasks immediately for tests.
 */
internal class ImmediateExecutorService(private val resolvableFuture: ResolvableFuture<*>) :
    MeasureExecutorService {
    override val isClosed: Boolean
        get() = false

    override fun submit(runnable: Runnable): Future<*> {
        DirectExecutor.INSTANCE.execute(runnable)
        return resolvableFuture
    }

    override fun schedule(runnable: Runnable, delayMillis: Long): Future<*> {
        DirectExecutor.INSTANCE.execute(runnable)
        return resolvableFuture
    }

    override fun scheduleAtFixedRate(
        runnable: Runnable,
        initialDelay: Long,
        delayMillis: Long,
        delayUnit: TimeUnit
    ): Future<*> {
        DirectExecutor.INSTANCE.execute(runnable)
        return resolvableFuture
    }

    override fun close(timeoutMillis: Long) {
        // no-op
    }
}