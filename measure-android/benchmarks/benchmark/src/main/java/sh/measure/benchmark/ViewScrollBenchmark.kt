package sh.measure.benchmark

import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.TraceSectionMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ViewScrollBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @OptIn(ExperimentalMetricApi::class)
    @Test
    fun getTargetBenchmarkForViewScrollGesture() {
        benchmarkRule.measureRepeated(packageName = "sh.measure.test.benchmark", metrics = listOf(
            TraceSectionMetric(
                sectionName = "GestureCollector.getTarget",
                mode = TraceSectionMetric.Mode.Sum,
            )
        ), iterations = 50, startupMode = StartupMode.WARM, setupBlock = {
            pressHome()
            startActivityAndWait()
            device.findObject(By.text("View Scroll Benchmark")).click()
            device.waitForIdle()
        }) {
            repeat(3) {
                val scrollView = By.res("sh.measure.test.benchmark", "sv_scroll_view")
                device.wait(Until.hasObject(scrollView), 30_000)
                device.findObject(scrollView).setGestureMargin(device.displayWidth / 5)
                device.findObject(scrollView).scroll(Direction.DOWN, 1.0f)
                device.findObject(scrollView).scroll(Direction.UP, 1.0f)
            }
        }
    }
}