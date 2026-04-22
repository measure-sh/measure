package sh.measure.baseline.target

import android.app.Application
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig

class BaselineTargetApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Measure.init(
            this,
            measureConfig = MeasureConfig(autoStart = true),
        )
    }
}
