package sh.measure.test.benchmark

import android.app.Application
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig

class MeasureEnabledApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Measure.init(
            this,
            MeasureConfig(
                enableLogging = true,
                trackActivityIntentData = true,
            )
        )
    }
}