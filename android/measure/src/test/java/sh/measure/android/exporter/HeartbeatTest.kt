package sh.measure.android.exporter

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.fakes.FakeRandomizer
import sh.measure.android.fakes.NoopLogger
import java.util.concurrent.Callable
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

internal class HeartbeatTest {
    private val logger = NoopLogger()
    private val fakeRandomizer = FakeRandomizer()

    private val testExecutor = object : MeasureExecutorService {
        var capturedCallable: Callable<*>? = null

        override fun <T> submit(callable: Callable<T>): Future<T> = throw UnsupportedOperationException()

        override fun <T> schedule(callable: Callable<T>, delayMillis: Long): Future<T> {
            capturedCallable = callable
            return object : Future<T> {
                override fun cancel(mayInterruptIfRunning: Boolean) = true
                override fun isCancelled() = false
                override fun isDone() = true
                override fun get(): T? = null
                override fun get(timeout: Long, unit: TimeUnit): T? = null
            }
        }

        override fun scheduleAtFixedRate(
            runnable: Runnable,
            initialDelay: Long,
            delayMillis: Long,
            delayUnit: TimeUnit,
        ): Future<*> = throw UnsupportedOperationException()

        override fun shutdown() {}
    }

    @Test
    fun `sets a listener`() {
        fakeRandomizer.randomInt = 0
        val heartbeat = HeartbeatImpl(logger, testExecutor, fakeRandomizer)
        heartbeat.addListener(object : HeartbeatListener {
            override fun pulse() {
            }
        })
        assertEquals(1, heartbeat.listeners.size)
    }

    @Test
    fun `invokes listeners`() {
        val intervalMs = 1000L
        fakeRandomizer.randomInt = 0

        var pulseInvokedCount = 0

        val heartbeat = HeartbeatImpl(logger, testExecutor, fakeRandomizer)
        heartbeat.addListener(object : HeartbeatListener {
            override fun pulse() {
                pulseInvokedCount++
            }
        })

        heartbeat.start(intervalMs, 0)
        testExecutor.capturedCallable?.call()

        assertEquals(1, pulseInvokedCount)
    }

    @Test
    fun `applies jitter to interval`() {
        val intervalMs = 1000L
        val jitterMs = 15000L
        val jitterValue = 10000
        fakeRandomizer.randomInt = jitterValue

        var pulseInvokedCount = 0
        val heartbeat = HeartbeatImpl(logger, testExecutor, fakeRandomizer)
        heartbeat.addListener(object : HeartbeatListener {
            override fun pulse() {
                pulseInvokedCount++
            }
        })

        heartbeat.start(intervalMs, jitterMs)
        testExecutor.capturedCallable?.call()

        assertEquals(1, pulseInvokedCount)
    }
}
