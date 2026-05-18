package sh.measure.benchmark

import android.content.Intent
import android.os.SystemClock
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MemoryUsageMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.TraceSectionMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Measures the synchronous cost of Measure's gesture tracking when a tap lands on a
 * Compose hierarchy (`LayoutInspector` walks the Compose semantics tree).
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class ComposeClickBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @OptIn(ExperimentalMetricApi::class)
    @Test
    fun clickBenchmark() {
        val packageName = "sh.measure.baseline.target"
        benchmarkRule.measureRepeated(
            packageName = packageName,
            metrics = listOf(
                TraceSectionMetric("msr-trackGesture", TraceSectionMetric.Mode.Average),
                MemoryUsageMetric(
                    MemoryUsageMetric.Mode.Max,
                    listOf(MemoryUsageMetric.SubMetric.HeapSize),
                ),
                FrameTimingMetric(),
            ),
            iterations = 35,
            startupMode = StartupMode.WARM,
            setupBlock = {
                pressHome()
                val intent = Intent().apply {
                    setClassName(packageName, "$packageName.ComposeClickActivity")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivityAndWait(intent)
                // Clears the 750 ms LayoutSnapshotThrottler window so the first tap of
                // every iteration exercises the snapshot path.
                SystemClock.sleep(800)
                device.waitForIdle()
            },
        ) {
            val button = device.findObject(By.res("compose_button"))
            repeat(3) {
                button.click()
                device.waitForIdle()
            }
        }
    }
}
