package sh.measure.benchmark

import android.os.SystemClock
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MemoryUsageMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.TraceSectionMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ComposeClickBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @OptIn(ExperimentalMetricApi::class)
    @Test
    fun clickWithSnapshot() {
        benchmarkRule.measureRepeated(
            packageName = "sh.measure.test.benchmark",
            metrics = listOf(
                TraceSectionMetric(
                    sectionName = "msr-trackGesture",
                    mode = TraceSectionMetric.Mode.Average,
                ),
                MemoryUsageMetric(
                    MemoryUsageMetric.Mode.Max, listOf(MemoryUsageMetric.SubMetric.HeapSize),
                ),
                FrameTimingMetric(),
            ),
            iterations = 30, startupMode = StartupMode.WARM,
            setupBlock = {
                pressHome()
                startActivityAndWait()
                device.findObject(By.text("Compose Target Finder Benchmark")).click()
                waitForThrottlingDelay()

                device.waitForIdle()
            },
        ) {
            repeat(3) {
                val button = By.res("compose_button")
                device.wait(Until.hasObject(button), 30_000)
                device.findObject(button).click()
                waitForThrottlingDelay()
                device.waitForIdle()
            }
        }
    }

    // See [LayoutInspectionThrottler] which skips layout snapshot generation based on
    // a delay.
    private fun waitForThrottlingDelay() {
        SystemClock.sleep(800)
    }
}