package sh.measure.sample

import android.app.Application
import sh.measure.android.Measure
import sh.measure.android.buildAttributes
import sh.measure.android.config.MeasureConfig
import sh.measure.android.config.ScreenshotMaskLevel

class SampleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Measure.init(
            this, MeasureConfig(
                enableLogging = true,
                trackScreenshotOnCrash = true,
                screenshotMaskLevel = if (BuildConfig.DEBUG) {
                    ScreenshotMaskLevel.SensitiveFieldsOnly
                } else {
                    ScreenshotMaskLevel.AllTextAndMedia
                },
                trackHttpHeaders = true,
                trackHttpBody = true,
                trackActivityIntentData = true,
                httpUrlBlocklist = listOf("http://localhost:8080"),
                samplingRateForErrorFreeSessions = 1f,
                autoStart = false,
            )
        )
        Measure.setUserId("sample-user-sd")
        Measure.clearUserId()
        Measure.trackScreenView("screen-name")
        Measure.trackHandledException(RuntimeException("sample-handled-exception"))
        val attributes = buildAttributes {
            put("key-1", 123)
            put("key-2", 123.45)
            put("key-3", "value")
            put("key-4", true)
        }
        Measure.trackEvent("custom-event", attributes)
        /*
        Measure.putAttribute("sample-key-1", 123)
        Measure.putAttribute("sample-key-2", 123.45)
        Measure.putAttribute("sample-key-3", "sample-value")
        Measure.putAttribute("sample-key-4", true)
        */
    }
}