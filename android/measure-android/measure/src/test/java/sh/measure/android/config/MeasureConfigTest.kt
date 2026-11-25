package sh.measure.android.config

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.logs.LogSeverity

class MeasureConfigTest {
    @Test
    fun `adaptive capture settings left unset match the SDK defaults`() {
        assertEquals(DynamicConfig(errorReplayDuration = 300, errorFatalTakeScreenshot = true), MeasureConfig().toDynamicConfig())
    }

    @Test
    fun `adaptive capture settings that are set replace the SDK defaults`() {
        val config = MeasureConfig(traceSamplingRate = 10f, logMinSeverity = LogSeverity.Error).toDynamicConfig()

        assertEquals(10f, config.traceSamplingRate)
        assertEquals(20, config.logMinSeverity)
    }
}
