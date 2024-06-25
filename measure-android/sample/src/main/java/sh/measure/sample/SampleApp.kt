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
                trackScreenshotOnCrash = true,
                screenshotMaskLevel = if (BuildConfig.DEBUG) {
                    ScreenshotMaskLevel.SensitiveFieldsOnly
                } else {
                    ScreenshotMaskLevel.AllTextAndMedia
                },
                trackHttpHeaders = true,
                trackHttpBody = true,
                trackActivityIntentData = true,
            )
        )
        Measure.setUserId("sample-user-sd")
        Measure.trackNavigation("sample-to", "sample-from")
        Measure.trackHandledException(RuntimeException("sample-handled-exception"))
    }
}