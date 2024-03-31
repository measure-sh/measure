package sh.measure.android.applaunch

import android.app.Application
import android.os.Bundle
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert
import org.junit.Ignore
import org.junit.Test
import sh.measure.android.TestActivity
import sh.measure.android.fakes.FakeEventProcessor
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider

internal class AppLaunchCollectorTest {

    private val logger = NoopLogger()

    @Test
    fun tracks_cold_launch() {
        val tracker = FakeEventProcessor()
        coldLaunch(tracker)
        Assert.assertEquals(1, tracker.trackedColdLaunchData.size)
    }

    @Test
    fun triggers_cold_launch_listener() {
        val tracker = FakeEventProcessor()
        var invoked = false
        val coldLaunchListener = {
            invoked = true
        }
        coldLaunch(tracker, coldLaunchListener = coldLaunchListener)
        Assert.assertTrue(invoked)
    }

    @Test
    fun stops_cold_launch_trace_on_cold_launch_complete() {
        val tracker = FakeEventProcessor()
        val coldLaunchTrace = FakeColdLaunchTrace().apply { start() }
        coldLaunch(tracker, coldLaunchTrace = coldLaunchTrace)
        Assert.assertFalse(coldLaunchTrace.traceRunning)
    }

    private fun coldLaunch(
        tracker: FakeEventProcessor,
        coldLaunchListener: () -> Unit = {},
        coldLaunchTrace: ColdLaunchTrace = FakeColdLaunchTrace(),
        savedStateBundle: Bundle? = null,
    ) {
        ActivityScenario.launch(TestActivity::class.java, savedStateBundle).use { scenario ->
            AppLaunchCollector(
                application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application,
                logger = logger,
                eventProcessor = tracker,
                timeProvider = AndroidTimeProvider(),
                coldLaunchTrace = coldLaunchTrace,
                coldLaunchListener = coldLaunchListener,
            ).register()
            scenario.moveToState(Lifecycle.State.CREATED)
            scenario.moveToState(Lifecycle.State.STARTED)
            scenario.moveToState(Lifecycle.State.RESUMED)
        }
    }

    @Test
    fun tracks_warm_launch() {
        val tracker = FakeEventProcessor()
        warmLaunch(tracker)
        Assert.assertEquals(1, tracker.trackedWarmLaunchData.size)
    }

    @Test
    fun warm_launch_has_saved_state() {
        val tracker = FakeEventProcessor()
        warmLaunch(tracker)
        Assert.assertTrue(tracker.trackedWarmLaunchData[0].data.has_saved_state)
    }

    private fun warmLaunch(tracker: FakeEventProcessor) {
        ActivityScenario.launch(TestActivity::class.java).use { scenario ->
            AppLaunchCollector(
                application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application,
                logger = logger,
                eventProcessor = tracker,
                timeProvider = AndroidTimeProvider(),
                coldLaunchTrace = FakeColdLaunchTrace(),
                coldLaunchListener = {},
            ).register()
            scenario.moveToState(Lifecycle.State.CREATED)
            scenario.moveToState(Lifecycle.State.STARTED)
            scenario.moveToState(Lifecycle.State.RESUMED)
            scenario.recreate()
        }
    }

    @Test
    @Ignore("Unable to reproduce a hot launch")
    fun tracks_hot_launch() {
        val tracker = FakeEventProcessor()
        ActivityScenario.launch(TestActivity::class.java).use { scenario ->
            val coldLaunchListener = {}
            AppLaunchCollector(
                application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application,
                logger = logger,
                eventProcessor = tracker,
                timeProvider = AndroidTimeProvider(),
                coldLaunchTrace = FakeColdLaunchTrace(),
                coldLaunchListener = coldLaunchListener,
            ).register()

            scenario.moveToState(Lifecycle.State.CREATED)
            scenario.moveToState(Lifecycle.State.STARTED)
            scenario.moveToState(Lifecycle.State.RESUMED)
            scenario.moveToState(Lifecycle.State.STARTED)
            scenario.moveToState(Lifecycle.State.RESUMED)
        }
        Assert.assertEquals(1, tracker.trackedHotLaunchData.size)
    }
}
