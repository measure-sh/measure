package sh.measure.android.fakes

import androidx.concurrent.futures.DirectExecutor
import androidx.concurrent.futures.ResolvableFuture
import sh.measure.android.executors.MeasureExecutorService
import java.util.concurrent.Callable
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

/**
 * A [MeasureExecutorService] which executes all tasks immediately for tests.
 */
internal class ImmediateExecutorService(private val resolvableFuture: ResolvableFuture<Any?>) : MeasureExecutorService {

    @Suppress("UNCHECKED_CAST")
    override fun <T> submit(callable: Callable<T>): Future<T> = try {
        val result = callable.call()
        (resolvableFuture as ResolvableFuture<T>).set(result)
        resolvableFuture
    } catch (e: Exception) {
        (resolvableFuture as ResolvableFuture<T>).setException(e)
        resolvableFuture
    }

    @Suppress("UNCHECKED_CAST")
    override fun <T> schedule(callable: Callable<T>, delayMillis: Long): Future<T> = try {
        val result = callable.call()
        (resolvableFuture as ResolvableFuture<T>).set(result)
        resolvableFuture
    } catch (e: Exception) {
        (resolvableFuture as ResolvableFuture<T>).setException(e)
        resolvableFuture
    }

    override fun scheduleAtFixedRate(
        runnable: Runnable,
        initialDelay: Long,
        delayMillis: Long,
        delayUnit: TimeUnit,
    ): Future<*> {
        DirectExecutor.INSTANCE.execute(runnable)
        return resolvableFuture
    }

    override fun shutdown() {
        // No-op
    }
}
