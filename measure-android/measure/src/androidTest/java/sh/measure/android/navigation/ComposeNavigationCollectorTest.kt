package sh.measure.android.navigation

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.espresso.Espresso.pressBack
import androidx.test.ext.junit.runners.AndroidJUnit4
import junit.framework.TestCase.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.Measure
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeEventProcessor
import sh.measure.android.fakes.FakeMeasureInitializer
import sh.measure.android.fakes.FakeTimeProvider

@RunWith(AndroidJUnit4::class)
class ComposeNavigationCollectorTest {
    private var eventProcessor = FakeEventProcessor()
    private var timeProvider = FakeTimeProvider()

    @get:Rule
    val composeRule = createComposeRule()

    @Before
    fun setup() {
        Measure.initForInstrumentationTest(
            FakeMeasureInitializer().apply {
                eventProcessor = this@ComposeNavigationCollectorTest.eventProcessor
                timeProvider = this@ComposeNavigationCollectorTest.timeProvider
            },
        )
    }

    @Test
    fun tracks_navigation_event_for_compose_navigation() {
        composeRule.setContent {
            testApp()
        }

        // initial state
        val navigationEvents = eventProcessor.getTrackedEventsByType(EventType.NAVIGATION)
        assertEquals(1, navigationEvents.size)
        assertEquals(null, (navigationEvents[0].data as NavigationData).from)
        assertEquals("home", (navigationEvents[0].data as NavigationData).to)
        assertEquals("androidx-navigation", (navigationEvents[0].data as NavigationData).source)

        // forward navigation
        composeRule.onNodeWithText("Checkout").performClick()
        assertEquals(2, navigationEvents.size)
        assertEquals("home", (navigationEvents[1].data as NavigationData).from)
        assertEquals("checkout", (navigationEvents[1].data as NavigationData).to)
        assertEquals("androidx-navigation", (navigationEvents[1].data as NavigationData).source)

        // back
        pressBack()
        assertEquals(3, navigationEvents.size)
        assertEquals("checkout", (navigationEvents[2].data as NavigationData).from)
        assertEquals("home", (navigationEvents[2].data as NavigationData).to)
        assertEquals("androidx-navigation", (navigationEvents[2].data as NavigationData).source)
    }
}
