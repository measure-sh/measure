package sh.measure.android.config

import org.junit.Assert
import org.junit.Test

class MeasureConfigTest {

    @Test
    fun `fromJson converts input map to MeasureConfig`() {
        val config = mapOf(
            "enableLogging" to true,
            "trackScreenshotOnCrash" to true,
            "autoInitializeNativeSDK" to true,
            "autoStart" to true,
            "trackHttpHeaders" to true,
            "trackHttpBody" to true,
            "httpHeadersBlocklist" to emptyList<String>(),
            "httpUrlBlocklist" to listOf("http://localhost"),
            "httpUrlAllowlist" to emptyList<String>(),
            "trackActivityIntentData" to false,
            "samplingRateForErrorFreeSessions" to 1.0,
            "traceSamplingRate" to 1.0,
            "trackViewControllerLoadTime" to true,
        )

        val measureConfig = MeasureConfig.fromJson(config)

        Assert.assertEquals(true, measureConfig.enableLogging)
        Assert.assertEquals(true, measureConfig.trackScreenshotOnCrash)
        Assert.assertEquals(true, measureConfig.autoStart)
        Assert.assertEquals(true, measureConfig.trackHttpHeaders)
        Assert.assertEquals(true, measureConfig.trackHttpBody)
        Assert.assertEquals(emptyList<String>(), measureConfig.httpHeadersBlocklist)
        Assert.assertEquals(listOf("http://localhost"), measureConfig.httpUrlBlocklist)
        Assert.assertEquals(emptyList<String>(), measureConfig.httpUrlAllowlist)
        Assert.assertEquals(false, measureConfig.trackActivityIntentData)
        Assert.assertEquals(1.0f, measureConfig.samplingRateForErrorFreeSessions)
        Assert.assertEquals(1.0f, measureConfig.traceSamplingRate)
    }
}
