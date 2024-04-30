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
        Measure.initForInstrumentationTest(FakeMeasureInitializer().apply {
            eventProcessor = this@ComposeNavigationCollectorTest.eventProcessor
            timeProvider = this@ComposeNavigationCollectorTest.timeProvider
        })
    }

    @Test
    fun tracks_navigation_event_for_compose_navigation() {
        composeRule.setContent {
            testApp()
        }

        // initial state
        assertEquals(1, eventProcessor.trackedEvents.size)
        assertEquals("home", (eventProcessor.trackedEvents[0].data as NavigationData).route)

        // forward navigation
        composeRule.onNodeWithText("Checkout").performClick()
        assertEquals(2, eventProcessor.trackedEvents.size)
        assertEquals("checkout", (eventProcessor.trackedEvents[1].data as NavigationData).route)

        // back
        pressBack()
        assertEquals(3, eventProcessor.trackedEvents.size)
        assertEquals("home", (eventProcessor.trackedEvents[2].data as NavigationData).route)
    }
}
