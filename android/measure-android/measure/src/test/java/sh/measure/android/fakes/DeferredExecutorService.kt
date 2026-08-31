package sh.measure.android.fakes

import sh.measure.android.executors.MeasureExecutorService
import java.util.concurrent.Callable
import java.util.concurrent.Future
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * Queues tasks until a test runs them, so a test can assert on what happens while a task is
 * still pending.
 */
internal class DeferredExecutorService : MeasureExecutorService {
    private val tasks = ArrayDeque<FutureTask<*>>()

    val pendingTaskCount: Int get() = tasks.size

    override fun execute(command: Runnable) {
        tasks.addLast(FutureTask(command, null))
    }

    override fun <T> submit(callable: Callable<T>): Future<T> = FutureTask(callable).also {
        tasks.addLast(it)
    }

    override fun <T> schedule(callable: Callable<T>, delayMillis: Long): Future<T> = submit(callable)

    override fun scheduleAtFixedRate(
        runnable: Runnable,
        initialDelay: Long,
        delayMillis: Long,
        delayUnit: TimeUnit,
    ): Future<*> = FutureTask(runnable, null).also {
        tasks.addLast(it)
    }

    override fun shutdown() {
        tasks.clear()
    }

    fun runAll() {
        while (true) {
            val task = tasks.removeFirstOrNull() ?: return
            task.run()
        }
    }
}
