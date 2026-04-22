package sh.measure.android.applaunch

import android.app.Application
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.Logger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.FakeSampler
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.TimeProvider
import java.time.Duration

class AppLaunchCollectorTest {
    private val application: Application = mock()
    private val logger: Logger = NoopLogger()
    private val signalProcessor: SignalProcessor = mock()
    private val launchTracker: LaunchTracker = mock()
    private val sampler: Sampler = FakeSampler()
    private val testClock = TestClock.create()
    private val timeProvider: TimeProvider = AndroidTimeProvider(testClock)

    private lateinit var collector: AppLaunchCollector

    @Before
    fun setup() {
        collector = AppLaunchCollector(
            application = application,
            logger = logger,
            timeProvider = timeProvider,
            signalProcessor = signalProcessor,
            launchTracker = launchTracker,
            sampler = sampler,
        )
    }

    @Test
    fun `buffers events before config is loaded`() {
        collector.onColdLaunch(createColdLaunchData())

        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `flushes buffered events when config is loaded`() {
        val coldLaunchData = createColdLaunchData()
        collector.onColdLaunch(coldLaunchData)

        collector.onConfigLoaded()

        verify(signalProcessor).track(
            data = eq(coldLaunchData),
            timestamp = any(),
            type = eq(EventType.COLD_LAUNCH),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(mutableMapOf()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
            isSampled = eq(true),
        )
    }

    @Test
    fun `buffered events use timestamp captured at event time`() {
        val coldLaunchData = createColdLaunchData()
        val eventTimestamp = timeProvider.now()
        collector.onColdLaunch(coldLaunchData)

        testClock.advance(Duration.ofMillis(5000))
        collector.onConfigLoaded()

        verify(signalProcessor).track(
            timestamp = eventTimestamp,
            type = EventType.COLD_LAUNCH,
            data = coldLaunchData,
            isSampled = true,
        )
    }

    @Test
    fun `tracks events directly after config is loaded`() {
        collector.onConfigLoaded()
        val coldLaunchData = createColdLaunchData()

        collector.onColdLaunch(coldLaunchData)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.COLD_LAUNCH,
            data = coldLaunchData,
            isSampled = true,
        )
    }

    private fun createColdLaunchData() = ColdLaunchData(
        process_start_uptime = 50L,
        content_provider_attach_uptime = null,
        process_start_requested_uptime = null,
        launched_activity = "MainActivity",
        intent_data = null,
        has_saved_state = false,
        on_next_draw_uptime = 100,
    )
}
