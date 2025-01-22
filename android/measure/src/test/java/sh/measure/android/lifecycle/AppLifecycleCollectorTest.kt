package sh.measure.android.lifecycle

import android.app.Application
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.kotlin.never
import org.robolectric.Robolectric.buildActivity
import org.robolectric.android.controller.ActivityController
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

@RunWith(AndroidJUnit4::class)
class AppLifecycleCollectorTest {
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val application = InstrumentationRegistry.getInstrumentation().context as Application
    private val appLifecycleManager = AppLifecycleManager(application)
    private val appLifecycleCollector: AppLifecycleCollector = AppLifecycleCollector(
        appLifecycleManager,
        signalProcessor,
        timeProvider,
    )
    private lateinit var controller: ActivityController<TestLifecycleActivity>

    @Before
    fun setup() {
        appLifecycleManager.register()
        appLifecycleCollector.register()
        controller = buildActivity(TestLifecycleActivity::class.java)
    }

    @Test
    fun `tracks application background event when all activities are stopped`() {
        controller.setup().stop()
        verify(signalProcessor, times(1)).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.BACKGROUND,
            ),
        )
    }

    @Test
    fun `tracks application foreground event when first activity starts`() {
        controller.setup()
        verify(signalProcessor, times(1)).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.FOREGROUND,
            ),
        )
    }

    @Test
    fun `does not trigger application lifecycle events on configuration change`() {
        controller.setup().configurationChange()

        // foreground will be called once during setup
        verify(signalProcessor, times(1)).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.FOREGROUND,
            ),
        )
        verify(signalProcessor, never()).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.BACKGROUND,
            ),
        )
    }

    @Test
    fun `unregister stops triggering events`() {
        appLifecycleCollector.unregister()
        controller.setup().stop()

        verify(signalProcessor, never()).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.FOREGROUND,
            ),
        )
        verify(signalProcessor, never()).track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_APP,
            data = ApplicationLifecycleData(
                type = AppLifecycleType.BACKGROUND,
            ),
        )
    }
}
