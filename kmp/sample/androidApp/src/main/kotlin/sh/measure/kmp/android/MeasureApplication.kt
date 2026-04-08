package sh.measure.kmp.android

import android.app.Application
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig

class MeasureApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Measure.init(
            this, MeasureConfig(
                enableFullCollectionMode = true,
                enableLogging = true,
            )
        )
    }
}
