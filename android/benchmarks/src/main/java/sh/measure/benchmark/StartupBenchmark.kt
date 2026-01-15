package sh.measure.benchmark

import androidx.benchmark.macro.BaselineProfileMode
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.TraceSectionMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Startup benchmarks for measuring the impact of baseline profiles on app startup time.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class StartupBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    /**
     * Measures startup time WITH baseline profile applied.
     * This represents the optimized startup experience for users.
     */
    @Test
    fun startupWithBaselineProfile() {
        startup(
            compilationMode = CompilationMode.Partial(
                baselineProfileMode = BaselineProfileMode.Require,
                warmupIterations = 3
            )
        )
    }

    /**
     * Measures startup time WITHOUT baseline profile.
     * This represents the unoptimized startup experience.
     * Use this as the baseline for comparison.
     */
    @Test
    fun startupWithoutBaselineProfile() {
        startup(
            compilationMode = CompilationMode.Partial(
                baselineProfileMode = BaselineProfileMode.Disable,
                warmupIterations = 3
            )
        )
    }

    /**
     * Measures startup time with full AOT compilation (best case, but unrealistic).
     * This shows the theoretical best performance possible.
     */
    @Test
    fun startupFullCompilation() {
        startup(compilationMode = CompilationMode.Full())
    }

    @OptIn(ExperimentalMetricApi::class)
    private fun startup(compilationMode: CompilationMode) {
        benchmarkRule.measureRepeated(
            packageName = "sh.measure.sample",
            metrics = listOf(
                StartupTimingMetric(),
                TraceSectionMetric("msr-init")
            ),
            iterations = 35,
            startupMode = StartupMode.COLD,
            compilationMode = compilationMode
        ) {
            pressHome()
            startActivityAndWait()
        }
    }
}
