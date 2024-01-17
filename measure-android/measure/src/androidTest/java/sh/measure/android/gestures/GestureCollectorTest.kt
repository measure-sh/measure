package sh.measure.android.gestures

import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.longClick
import androidx.test.espresso.action.ViewActions.swipeUp
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.fakes.FakeEventTracker
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.test.R
import sh.measure.android.utils.CurrentThread

@RunWith(AndroidJUnit4::class)
@LargeTest
internal class GestureCollectorTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private lateinit var tracker: FakeEventTracker
    private val currentThread = CurrentThread()

    @Before
    fun setup() {
        tracker = FakeEventTracker()
    }

    @Test
    fun tracks_clicks_on_clickable_views() {
        GestureCollector(logger, tracker, timeProvider, currentThread).register()
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.button)).perform(click())
        Assert.assertEquals(1, tracker.trackedClicks.size)
    }

    @Test
    fun ignores_clicks_on_non_clickable_views() {
        GestureCollector(logger, tracker, timeProvider, currentThread).register()
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.text)).perform(click())
        Assert.assertEquals(0, tracker.trackedClicks.size)
    }

    @Test
    fun tracks_long_clicks_on_clickable_views() {
        GestureCollector(logger, tracker, timeProvider, currentThread).register()
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.button)).perform(longClick())
        Assert.assertEquals(1, tracker.trackedLongClicks.size)
    }

    @Test
    fun ignores_long_clicks_on_non_clickable_views() {
        GestureCollector(logger, tracker, timeProvider, currentThread).register()
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.text)).perform(longClick())
        Assert.assertEquals(0, tracker.trackedClicks.size)
    }

    @Test
    fun tracks_scroll_on_scrollable_views() {
        GestureCollector(logger, tracker, timeProvider, currentThread).register()
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.scroll_view)).perform(swipeUp())
        Assert.assertEquals(1, tracker.trackedScrolls.size)
    }

    @Test
    fun ignores_scrolls_on_non_scrollable_views() {
        GestureCollector(logger, tracker, timeProvider, currentThread).register()
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.text)).perform(swipeUp())
        Assert.assertEquals(0, tracker.trackedScrolls.size)
    }
}
