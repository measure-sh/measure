package sh.measure.android

import android.view.View
import android.view.ViewGroup
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.NoMatchingViewException
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import org.hamcrest.Description
import org.hamcrest.Matcher
import org.hamcrest.TypeSafeMatcher

/**
 * Helper function to wait for a view to be displayed with a timeout.
 * @param viewMatcher The matcher for the view to find
 * @param timeoutMillis Maximum time to wait in milliseconds
 * @param intervalMillis Time to wait between checks in milliseconds
 * @return True if the view was found within the timeout, false otherwise
 */
fun waitForViewToBeDisplayed(
    viewMatcher: Matcher<View>,
    timeoutMillis: Long = 3000,
    intervalMillis: Long = 100,
): Boolean {
    val startTime = System.currentTimeMillis()
    var viewFound = false

    while (!viewFound && System.currentTimeMillis() - startTime < timeoutMillis) {
        try {
            onView(viewMatcher).check(matches(isDisplayed()))
            viewFound = true
        } catch (e: NoMatchingViewException) {
            Thread.sleep(intervalMillis)
        }
    }

    return viewFound
}

/**
 * Returns a matcher that matches a view that is the nth child of a parent view that matches the given parent matcher.
 *
 * This matcher can be used to find a specific child view at a certain position within a parent view,
 * which is useful when multiple similar child views exist and you need to target a specific one by position.
 *
 * @param parentMatcher The matcher that will match the parent of the view
 * @param childPosition The position of the child view to match (0-based index)
 * @return A Matcher<View> that matches a view at the specified child position within a parent matching parentMatcher
 */
fun nthChildOf(parentMatcher: Matcher<View>, childPosition: Int): Matcher<View> {
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
