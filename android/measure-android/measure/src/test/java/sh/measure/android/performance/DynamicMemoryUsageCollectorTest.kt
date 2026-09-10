package sh.measure.android.performance

import android.app.ActivityManager.RunningAppProcessInfo
import androidx.concurrent.futures.ResolvableFuture
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeMemoryReader
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeSampler
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.lifecycle.AppLifecycleManager
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

internal class DynamicMemoryUsageCollectorTest {
    private val clock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(clock)
    private val signalProcessor = mock<SignalProcessor>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val memoryReader = FakeMemoryReader()
    private val processInfo = FakeProcessInfoProvider()
    private val sampler = FakeSampler()
    private val sessionManager = FakeSessionManager()
    private val appLifecycleManager = mock<AppLifecycleManager>()
    private val collector = DynamicMemoryUsageCollector(
        NoopLogger(),
        signalProcessor,
        timeProvider,
        executorService,
        memoryReader,
        sampler,
        sessionManager,
        processInfo,
        appLifecycleManager,
    )

    @Test
    fun `reads process_state from the current process importance, not the fg-bg schedule flag`() {
        processInfo.importance = RunningAppProcessInfo.IMPORTANCE_CACHED
        collector.register()

        verify(signalProcessor).track(
            type = EventType.MEMORY_USAGE_DYNAMIC,
            timestamp = timeProvider.now(),
            data = MemoryUsageDynamicData(
                anon_rss = memoryReader.anonRss(),
                swap = memoryReader.swap(),
                process_state = ProcessState.CACHED,
                interval = 0,
            ),
        )
    }

    @Test
    fun `onAppForeground reports the process_state read at that instant`() {
        processInfo.importance = RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        collector.onAppForeground()

        // onAppForeground both tracks immediately and reschedules, and
        // ImmediateExecutorService runs the rescheduled read synchronously
        // too — atLeastOnce avoids coupling this test to that incidental
        // double read, which isn't what this test is about.
        verify(signalProcessor, org.mockito.Mockito.atLeastOnce()).track(
            type = EventType.MEMORY_USAGE_DYNAMIC,
            timestamp = timeProvider.now(),
            data = MemoryUsageDynamicData(
                anon_rss = memoryReader.anonRss(),
                swap = memoryReader.swap(),
                process_state = ProcessState.FOREGROUND,
                interval = 0,
            ),
        )
    }

    @Test
    fun `onAppBackground reports the process_state read at that instant`() {
        processInfo.importance = RunningAppProcessInfo.IMPORTANCE_SERVICE
        collector.onAppBackground()

        verify(signalProcessor, org.mockito.Mockito.atLeastOnce()).track(
            type = EventType.MEMORY_USAGE_DYNAMIC,
            timestamp = timeProvider.now(),
            data = MemoryUsageDynamicData(
                anon_rss = memoryReader.anonRss(),
                swap = memoryReader.swap(),
                process_state = ProcessState.BACKGROUND,
                interval = 0,
            ),
        )
    }

    @Test
    fun `does not track when the current session is not sampled`() {
        sampler.trackMemoryForSession = false
        collector.register()
        org.mockito.Mockito.verifyNoInteractions(signalProcessor)
    }
}
