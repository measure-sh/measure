package sh.measure.sample

import android.app.Application
import sh.measure.android.Measure
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
            )
        )
        Measure.setUserId("sample-user-sd")
        Measure.clearUserId()
        Measure.trackNavigation("sample-to", "sample-from")
        Measure.trackHandledException(RuntimeException("sample-handled-exception"))
        /*
        Measure.putAttribute("sample-key-1", 123)
        Measure.putAttribute("sample-key-2", 123.45)
        Measure.putAttribute("sample-key-3", "sample-value")
        Measure.putAttribute("sample-key-4", true)
        */
    }
}