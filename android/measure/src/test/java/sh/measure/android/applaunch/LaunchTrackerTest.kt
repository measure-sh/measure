package sh.measure.android.applaunch

import android.app.Application
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.kotlin.argumentCaptor
import org.robolectric.Robolectric.buildActivity
import org.robolectric.android.controller.ActivityController
import sh.measure.android.TestLifecycleActivity
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.tracing.SpanData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.TestTracer
import sh.measure.android.utils.forceDrawFrame

@RunWith(AndroidJUnit4::class)
class LaunchTrackerTest {
    private val logger = NoopLogger()
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val sessionManager = FakeSessionManager()
    private val configProvider = FakeConfigProvider()
    private val application = InstrumentationRegistry.getInstrumentation().context as Application
    private val tracer =
        TestTracer(signalProcessor, configProvider, logger, timeProvider, sessionManager)
    private var launchTracker: LaunchTracker = LaunchTracker()
    private lateinit var controller: ActivityController<TestLifecycleActivity>

    @Before
    fun setup() {
        application.registerActivityLifecycleCallbacks(launchTracker)
        controller = buildActivity(TestLifecycleActivity::class.java)
    }

    @After
    fun tearDown() {
        application.unregisterActivityLifecycleCallbacks(launchTracker)
    }

    @Test
    fun `tracks activity TTID span with correct name`() {
        // Given
        val callbacks = object : LaunchCallbacks {
            override fun onColdLaunch(coldLaunchData: ColdLaunchData, coldLaunchTime: Long?) {}
            override fun onWarmLaunch(warmLaunchData: WarmLaunchData, warmLaunchTime: Long?) {}
            override fun onHotLaunch(hotLaunchData: HotLaunchData) {}
        }
        launchTracker.registerCallbacks(callbacks, tracer, configProvider)
        // When
        val argumentCaptor = argumentCaptor<SpanData>()
        controller.setup().forceDrawFrame()

        // Then
        verify(signalProcessor, times(1)).trackSpan(argumentCaptor.capture())
        Assert.assertEquals(
            "Activity TTID ${TestLifecycleActivity::class.java.name}",
            argumentCaptor.firstValue.name,
        )
    }

    @Test
    fun `returns TTID span with correct name on delayed registration`() {
        // When
        controller.setup().forceDrawFrame()

        // Then
        val callbacks = object : LaunchCallbacks {
            override fun onColdLaunch(coldLaunchData: ColdLaunchData, coldLaunchTime: Long?) {}
            override fun onWarmLaunch(warmLaunchData: WarmLaunchData, warmLaunchTime: Long?) {}
            override fun onHotLaunch(hotLaunchData: HotLaunchData) {}
        }
        val preRegistrationData = launchTracker.registerCallbacks(callbacks, tracer, configProvider)
        Assert.assertEquals(
            "Activity TTID ${TestLifecycleActivity::class.java.name}",
            "Activity TTID ${preRegistrationData.firstActivityTTID?.activityName}",
        )
    }
}
