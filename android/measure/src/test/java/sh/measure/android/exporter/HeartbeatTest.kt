package sh.measure.android.exporter

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

internal class HeartbeatTest {
    private val logger = NoopLogger()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())

    @Test
    fun `sets a listener`() {
        val heartbeat = HeartbeatImpl(logger, executorService)
        heartbeat.addListener(object : HeartbeatListener {
            override fun pulse() {
            }
        })
        assertEquals(1, heartbeat.listeners.size)
    }

    @Test
    fun `invokes listeners`() {
        // Given
        val intervalMs = 1000L
        val initialDelayMs = 0L

        var pulseInvokedCount = 0

        val heartbeat = HeartbeatImpl(logger, executorService)
        heartbeat.addListener(object : HeartbeatListener {
            override fun pulse() {
                pulseInvokedCount++
            }
        })

        heartbeat.start(intervalMs, initialDelayMs)
        assertEquals(1, pulseInvokedCount)
    }
}
