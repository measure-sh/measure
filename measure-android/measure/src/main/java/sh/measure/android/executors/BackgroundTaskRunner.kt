package sh.measure.android.executors

import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadFactory
import kotlin.math.max

interface TaskRunner {
    fun execute(task: Runnable)
}

internal class BackgroundTaskRunner(threadFactory: ThreadFactory) : TaskRunner {

    private val bgExecutor = Executors.newFixedThreadPool(
        max(2, Runtime.getRuntime().availableProcessors()), threadFactory
    )

    @Throws(RejectedExecutionException::class, NullPointerException::class)
    override fun execute(task: Runnable) {
        bgExecutor.execute(task)
    }
}