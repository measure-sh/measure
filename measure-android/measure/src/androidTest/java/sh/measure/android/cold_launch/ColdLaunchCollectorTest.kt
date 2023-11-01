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
import sh.measure.android.TestActivity
import sh.measure.android.fakes.FakeEventTracker
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider

@RunWith(AndroidJUnit4::class)
@LargeTest
internal class ColdLaunchCollectorTest {
    private val logger = NoopLogger()
    private lateinit var tracker: FakeEventTracker

    @Before
    fun setup() {
        tracker = FakeEventTracker()
    }

    @Test
    fun tracks_cold_launch_time_event() {
        ActivityScenario.launch(TestActivity::class.java).use { scenario ->
            ColdLaunchCollector(
                application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application,
                logger = logger,
                eventTracker = tracker,
                timeProvider = AndroidTimeProvider(),
                launchInfo = LaunchState
            ).register()
            scenario.moveToState(State.CREATED)
            scenario.moveToState(State.STARTED)
            scenario.moveToState(State.RESUMED)
        }
        Assert.assertEquals(1, tracker.trackedColdLaunchEvents.size)
    }
}