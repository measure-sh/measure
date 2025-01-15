package sh.measure.android

import android.app.Application
import android.view.View
import android.view.ViewGroup
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.closeSoftKeyboard
import androidx.test.espresso.action.ViewActions.replaceText
import androidx.test.espresso.assertion.ViewAssertions.doesNotExist
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDescendantOfA
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.hamcrest.Description
import org.hamcrest.Matcher
import org.hamcrest.TypeSafeMatcher
import org.hamcrest.core.AllOf.allOf
import org.junit.Assert
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.EventType

internal class MsrBugReportActivityRobot {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.context.applicationContext
    private val device = UiDevice.getInstance(instrumentation)
    private val signalStore = FakeSignalStore()

    fun initializeMeasure(config: MeasureConfig = MeasureConfig()): TestMeasureInitializer {
        val initializer = TestMeasureInitializer(
            application = context as Application,
            inputConfig = config,
            signalStore = signalStore,
        )
        Measure.initForInstrumentationTest(initializer)
        return initializer
    }

    fun assertSendCtaEnabled(enabled: Boolean) {
        onView(withId(R.id.tv_send)).check(matches(isDisplayed())).check { view, _ ->
            Assert.assertEquals(enabled, view.isEnabled)
        }
    }

    fun enterDescription(length: Int = 100) {
        onView(withId(R.id.et_description))
            .perform(replaceText("a".repeat(length)))
            .perform(closeSoftKeyboard())
        device.waitForIdle()
    }

    fun assertBugReportActivityLaunched() {
        device.waitForIdle()
        onView(withId(R.id.tv_title)).check(matches(isDisplayed()))
    }

    fun assertBugReportActivityNotVisible() {
        device.waitForIdle()
        onView(withId(R.id.tv_title)).check(doesNotExist())
    }

    fun assertTotalScreenshots(value: Int) {
        onView(withId(R.id.sl_screenshots_container)).check { view, _ ->
            val viewGroup = view as ViewGroup
            Assert.assertEquals(value, viewGroup.childCount)
        }
    }

    fun clickCloseButton() {
        onView(withId(R.id.btn_close)).perform(click())
    }

    fun removeScreenshot(index: Int) {
        onView(
            allOf(
                withId(R.id.closeButton),
                isDescendantOfA(nthChildOf(withId(R.id.sl_screenshots_container), index)),
            ),
        ).perform(click())
    }

    fun clickAddImagesCTA() {
        onView(withId(R.id.tv_choose_image)).perform(click())
    }

    private fun nthChildOf(parentMatcher: Matcher<View>, childPosition: Int): Matcher<View> {
        return object : TypeSafeMatcher<View>() {
            override fun describeTo(description: Description) {
                description.appendText("with $childPosition child view of type parentMatcher")
            }

            override fun matchesSafely(view: View): Boolean {
                if (view.parent !is ViewGroup) return false
                val parent = view.parent as ViewGroup

                return parentMatcher.matches(parent) && parent.getChildAt(childPosition) == view
            }
        }
    }

    fun clickSendCTA() {
        onView(withId(R.id.tv_send)).perform(click())
    }

    fun assetBugReportTracked(attachmentCount: Int) {
        device.waitForIdle()
        val event = signalStore.trackedEvents.find {
            it.type == EventType.BUG_REPORT
        }
        Assert.assertNotNull(event)
        Assert.assertEquals(attachmentCount, event?.attachments?.size)
    }
}
