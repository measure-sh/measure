package sh.measure.benchmark

    import androidx.benchmark.macro.StartupMode
    import androidx.benchmark.macro.StartupTimingMetric
    import androidx.benchmark.macro.junit4.MacrobenchmarkRule
    import androidx.test.ext.junit.runners.AndroidJUnit4
    import org.junit.Rule
    import org.junit.Test
    import org.junit.runner.RunWith

    @RunWith(AndroidJUnit4::class)
    class StartupBenchmark {
        @get:Rule
        val benchmarkRule = MacrobenchmarkRule()

        @Test
        fun startupBenchmark() {
            benchmarkRule.measureRepeated(
                packageName = "sh.measure.test.benchmark",
                metrics = listOf(StartupTimingMetric()),
                iterations = 35,
                startupMode = StartupMode.COLD
            ) {
                pressHome()
                startActivityAndWait()
            }
        }
    }