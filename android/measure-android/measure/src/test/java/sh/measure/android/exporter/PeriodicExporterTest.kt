package sh.measure.android.exporter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import java.util.concurrent.Callable
import java.util.concurrent.Future
import java.util.concurrent.FutureTask
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

class PeriodicExporterTest {
    private val configProvider = FakeConfigProvider()
    private val exporter = mock<Exporter>()
    private val scheduler = FakeScheduler()
    private val periodicExporter = PeriodicExporterImpl(
        logger = NoopLogger(),
        configProvider = configProvider,
        exporter = exporter,
        scheduler = scheduler,
    )

    @Test
    fun `periodic exporter schedules export every debugExportIntervalMs when started in foreground`() {
        configProvider.debugExportIntervalMs = 5_000

        periodicExporter.setInForeground(true)
        periodicExporter.start()

        assertEquals(1, scheduler.scheduledCount)
        assertEquals(5_000L, scheduler.lastInitialDelayMs)
        assertEquals(5_000L, scheduler.lastIntervalMs)
    }

    @Test
    fun `periodic exporter calls exporter export() on every tick`() {
        periodicExporter.setInForeground(true)
        periodicExporter.start()

        scheduler.tick()
        scheduler.tick()

        verify(exporter, times(2)).export()
    }

    @Test
    fun `periodic exporter does not schedule when started in background`() {
        periodicExporter.start()

        assertEquals(0, scheduler.scheduledCount)
    }

    @Test
    fun `periodic exporter does not schedule in foreground until started`() {
        periodicExporter.setInForeground(true)

        assertEquals(0, scheduler.scheduledCount)
    }

    @Test
    fun `periodic exporter schedules only once when started multiple times`() {
        periodicExporter.setInForeground(true)
        periodicExporter.start()
        periodicExporter.start()

        assertEquals(1, scheduler.scheduledCount)
    }

    @Test
    fun `periodic exporter cancels scheduled export on stop`() {
        periodicExporter.setInForeground(true)
        periodicExporter.start()

        periodicExporter.stop()

        assertFalse(scheduler.isRunning)
    }

    @Test
    fun `periodic exporter cancels on background and reschedules on foreground`() {
        periodicExporter.setInForeground(true)
        periodicExporter.start()

        periodicExporter.setInForeground(false)
        assertFalse(scheduler.isRunning)

        periodicExporter.setInForeground(true)
        assertTrue(scheduler.isRunning)
        assertEquals(2, scheduler.scheduledCount)
    }

    @Test
    fun `periodic exporter retries scheduling on next start after executor rejects`() {
        val rejectingScheduler = mock<MeasureExecutorService>()
        whenever(rejectingScheduler.scheduleAtFixedRate(any(), any(), any(), any()))
            .thenThrow(RejectedExecutionException())
        val periodicExporter = PeriodicExporterImpl(
            logger = NoopLogger(),
            configProvider = configProvider,
            exporter = exporter,
            scheduler = rejectingScheduler,
        )

        periodicExporter.setInForeground(true)
        periodicExporter.start()
        periodicExporter.start()

        verify(rejectingScheduler, times(2)).scheduleAtFixedRate(any(), any(), any(), eq(TimeUnit.MILLISECONDS))
        verify(exporter, never()).export()
    }

    /**
     * Records fixed rate schedules so tests can run ticks and check cancellation.
     */
    private class FakeScheduler : MeasureExecutorService {
        private val futures = mutableListOf<FutureTask<*>>()
        private var lastRunnable: Runnable? = null
        var lastInitialDelayMs: Long? = null
        var lastIntervalMs: Long? = null

        val scheduledCount: Int get() = futures.size
        val isRunning: Boolean get() = futures.any { !it.isCancelled }

        override fun scheduleAtFixedRate(
            runnable: Runnable,
            initialDelay: Long,
            delayMillis: Long,
            delayUnit: TimeUnit,
        ): Future<*> {
            lastRunnable = runnable
            lastInitialDelayMs = delayUnit.toMillis(initialDelay)
            lastIntervalMs = delayUnit.toMillis(delayMillis)
            return FutureTask(runnable, null).also { futures.add(it) }
        }

        fun tick() {
            lastRunnable?.run()
        }

        override fun execute(command: Runnable) = command.run()

        override fun <T> submit(callable: Callable<T>): Future<T> = FutureTask(callable).also { it.run() }

        override fun <T> schedule(callable: Callable<T>, delayMillis: Long): Future<T> = submit(callable)

        override fun shutdown() = Unit
    }
}
