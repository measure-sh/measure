package sh.measure.sample

import android.app.Application
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.config.MeasureConfig

class SampleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val startTime = Measure.getCurrentTime()
        Measure.init(
            this,
            measureConfig = MeasureConfig(
                enableLogging = true,
                trackActivityIntentData = true,
                autoStart = true,
                maxDiskUsageInMb = 1500,
                enableFullCollectionMode = false,
            )
        )
        val appOnCreateSpan = Measure.startSpan("SampleApp.onCreate", timestamp = startTime)
        Measure.startSpan("Measure.init", timestamp = startTime).setParent(appOnCreateSpan).end()
        appOnCreateSpan.end()

        val attributes = AttributesBuilder().put(
            "string",
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in"
        ).put("integer", Int.MAX_VALUE).put("long", Long.MAX_VALUE).put("double", Double.MAX_VALUE)
            .put("float", Float.MAX_VALUE).put("boolean", false).build()
        Measure.trackEvent(name = "custom-app-start", attributes = attributes)
    }
}
