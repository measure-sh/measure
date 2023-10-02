package sh.measure.android.executors

import android.os.Process
import java.util.concurrent.ThreadFactory
import java.util.concurrent.atomic.AtomicInteger

internal class CustomThreadFactory : ThreadFactory {
    private var threadCount = AtomicInteger()
    override fun newThread(r: Runnable): Thread {
        val thread = Thread(r, "measure-thread-#${threadCount.getAndIncrement()}")
        Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
        return thread
    }
}