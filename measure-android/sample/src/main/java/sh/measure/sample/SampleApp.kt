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
                enableHttpHeadersCapture = true,
                enableHttpBodyCapture = true,
                trackLifecycleActivityIntent = true,
                trackColdLaunchIntent = true,
                trackWarmLaunchIntent = true,
                trackHotLaunchIntent = true,
            )
        )
    }
}