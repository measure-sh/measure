package sh.measure.android.gestures

import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.swipeUp
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.fakes.FakeEventProcessor
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.test.R

@RunWith(AndroidJUnit4::class)
class ComposeGestureCollectorTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private lateinit var tracker: FakeEventProcessor

    @Before
    fun setup() {
        tracker = FakeEventProcessor()
        GestureCollector(logger, tracker, timeProvider).register()
    }

    @Test
    fun tracks_clicks_on_clickable_views() {
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.clickable_compose_view)).perform(click())
        assertEquals(1, tracker.trackedEvents.size)
    }

    @Test
    fun tracks_clicked_view_properties() {
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.clickable_compose_view)).perform(click())

        val event = tracker.trackedEvents[0]
        event.data as ClickData
        assertEquals("androidx.compose.ui.platform.AndroidComposeView", event.data.target)
        assertEquals("compose_clickable", event.data.target_id)
        assertTrue(event.data.touch_down_time > 0)
        assertTrue(event.data.touch_up_time > 0)
        assertTrue(event.data.x > 0)
        assertTrue(event.data.y > 0)

        // we currently don't have ability to track compose view bounds:
        assertNull(event.data.width)
        assertNull(event.data.height)
    }

    @Test
    fun ignores_clicks_on_non_clickable_views() {
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.non_clickable_compose_view)).perform(click())
        assertEquals(0, tracker.trackedEvents.size)
    }

    @Test
    fun tracks_scrolls_on_scrollable_views() {
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.scrollable_compose_view)).perform(swipeUp())
        assertEquals(1, tracker.trackedEvents.size)
    }

    @Test
    fun tracks_scrollable_view_properties() {
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.scrollable_compose_view)).perform(swipeUp())

        val event = tracker.trackedEvents[0]
        event.data as ScrollData
        assertEquals("androidx.compose.ui.platform.AndroidComposeView", event.data.target)
        assertEquals("compose_scrollable", event.data.target_id)
        assertTrue(event.data.touch_down_time > 0)
        assertTrue(event.data.touch_up_time > 0)
        assertTrue(event.data.x > 0)
        assertTrue(event.data.y > 0)
    }

    @Test
    fun ignores_scrolls_on_non_scrollable_views() {
        ActivityScenario.launch(GestureTestActivity::class.java)
        onView(withId(R.id.clickable_compose_view)).perform(swipeUp())
        assertEquals(0, tracker.trackedEvents.size)
    }
}
