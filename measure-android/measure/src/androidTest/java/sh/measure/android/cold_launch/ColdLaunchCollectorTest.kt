package sh.measure.android.cold_launch

import android.app.Application
import androidx.lifecycle.Lifecycle.*
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import sh.measure.android.TestActivity
import sh.measure.android.fakes.FakeEventTracker
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider

@RunWith(AndroidJUnit4::class)
@LargeTest
internal class ColdLaunchCollectorTest {
    private val logger = NoopLogger()
    private lateinit var tracker: FakeEventTracker
    private val trace = FakeColdLaunchTrace()

    @Before
    fun setup() {
        tracker = FakeEventTracker()
        trace.traceRunning = true
    }

    @Test
    fun tracks_cold_launch_time_event_and_stops_trace() {
        ActivityScenario.launch(TestActivity::class.java).use { scenario ->
            ColdLaunchCollector(
                application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application,
                logger = logger,
                eventTracker = tracker,
                timeProvider = AndroidTimeProvider(),
                launchInfo = LaunchState,
                trace = trace,
            ).register()
            scenario.moveToState(State.CREATED)
            scenario.moveToState(State.STARTED)
            scenario.moveToState(State.RESUMED)
        }
        Assert.assertEquals(1, tracker.trackedColdLaunchEvents.size)
        Assert.assertEquals(trace.traceRunning, false)
    }
}