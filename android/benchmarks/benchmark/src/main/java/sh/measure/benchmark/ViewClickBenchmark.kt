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
class ViewClickBenchmark {
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
                TraceSectionMetric(
                    sectionName = "msr-generateSvgAttachment",
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
                device.findObject(By.text("View Target Finder Benchmark")).click()
                waitForSvgGenerationDelay()
                device.waitForIdle()
            },
        ) {
            repeat(3) {
                val button = By.res("sh.measure.test.benchmark", "btn_view_click")
                device.wait(Until.hasObject(button), 3_000)
                device.findObject(button).click()
                waitForSvgGenerationDelay()
            }
        }
    }

    // See [LayoutInspectionThrottler] which skips svg generation based on
    // a delay. Adding the delay here to ensure SVG is generated for each repetition
    private fun waitForSvgGenerationDelay() {
        SystemClock.sleep(800)
    }
}