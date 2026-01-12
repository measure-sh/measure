package sh.measure.android.flutter

import android.app.Application
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig

class SampleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Measure.init(
            this,
            MeasureConfig(
                enableLogging = true,
                autoStart = true,
                enableFullCollectionMode = true,
                trackActivityIntentData = true,
                maxDiskUsageInMb = 150,
            )
        )
    }
}