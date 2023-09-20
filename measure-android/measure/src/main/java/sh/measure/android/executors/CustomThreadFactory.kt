package sh.measure.android.executors

import android.os.Process
import android.os.Process.THREAD_PRIORITY_BACKGROUND
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory
import java.util.concurrent.atomic.AtomicInteger

private const val NAME_PREFIX = "Measure"

internal class CustomThreadFactory : ThreadFactory {
    private val defaultFactory = Executors.defaultThreadFactory()
    private val threadCount = AtomicInteger()

    override fun newThread(r: Runnable): Thread {
        val thread = defaultFactory.newThread {
            Process.setThreadPriority(THREAD_PRIORITY_BACKGROUND)
            r.run()
        }
        thread.name = String.format(
            Locale.ROOT, "%s Thread #%d", NAME_PREFIX, threadCount.getAndIncrement()
        )
        return thread
    }
}
