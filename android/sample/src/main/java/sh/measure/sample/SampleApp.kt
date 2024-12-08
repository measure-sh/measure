package sh.measure.sample

import android.app.Application
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig
import sh.measure.android.config.ScreenshotMaskLevel

class SampleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val startTime = Measure.getTimestamp()
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
                traceSamplingRate = 1.0f,
            )
        )
        val appOnCreateSpan = Measure.startSpan("SampleApp.onCreate", timestamp = startTime)
        appOnCreateSpan.withScope {
            Measure.startSpan("Measure.init", timestamp = startTime).end()
        }
        appOnCreateSpan.end()
    }
}
