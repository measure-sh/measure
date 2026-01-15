package sh.measure.benchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.TraceSectionMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class ClickBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @OptIn(ExperimentalMetricApi::class)
    @Test
    fun navigateToCheckout() {
        benchmarkRule.measureRepeated(
            packageName = "sh.measure.sample",
            metrics = listOf(
                FrameTimingMetric(),
                TraceSectionMetric("msr-trackGesture", TraceSectionMetric.Mode.Average),
                TraceSectionMetric("msr-generateSvgAttachment", TraceSectionMetric.Mode.Average),
            ),
            iterations = 10,
            startupMode = StartupMode.WARM,
            compilationMode = CompilationMode.Partial()
        ) {
            startActivityAndWait()

            // Click "XML based button" button
            device.findObject(By.text("Compose Navigation")).click()
            device.wait(Until.hasObject(By.text("Checkout")), 5000)

            // Ensures layout snapshot is triggered
            // for both to account for throttling.
            Thread.sleep(750)

            // Click "Compose" button
            device.findObject(By.text("Checkout")).click()
            device.wait(Until.hasObject(By.text("Checkout")), 5000)

            device.waitForIdle()
        }
    }
}
