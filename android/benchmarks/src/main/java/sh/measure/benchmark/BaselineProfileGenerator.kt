package sh.measure.benchmark

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Generates baseline profiles for the Measure SDK initialization flow.
 *
 * This profile captures the code paths executed during SDK initialization,
 * which is the critical path we want to optimize for library consumers.
 *
 * Run with: ./gradlew :measure:generateBaselineProfile
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class BaselineProfileGenerator {

    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generateBaselineProfile() {
        rule.collect(
            packageName = "sh.measure.sample",
            includeInStartupProfile = true,
            profileBlock = {
                // Start the app and wait for it to be ready
                // This will execute the Measure SDK initialization code path
                pressHome()
                startActivityAndWait()

                // Wait a bit to ensure SDK initialization completes
                device.waitForIdle()
            }
        )
    }
}
