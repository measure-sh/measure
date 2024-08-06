package sh.measure.benchmark

import androidx.benchmark.macro.ExperimentalMetricApi
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
class ViewTargetFinderBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @OptIn(ExperimentalMetricApi::class)
    @Test
    fun viewTargetFinderBenchmark() {
        benchmarkRule.measureRepeated(packageName = "sh.measure.test.benchmark",
            metrics = listOf(
                TraceSectionMetric(
                    sectionName = "msr-click-getTarget",
                    mode = TraceSectionMetric.Mode.Sum,
                )
            ),
            iterations = 50,
            startupMode = StartupMode.WARM,
            setupBlock = {
                pressHome()
                startActivityAndWait()
                device.findObject(By.text("View Target Finder Benchmark")).click()
                device.waitForIdle()
            }) {
            repeat(3) {
                val button = By.res("sh.measure.test.benchmark", "btn_view_click")
                device.wait(Until.hasObject(button), 30_000)
                device.findObject(button).click()
            }
        }
    }
}