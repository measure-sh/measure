package sh.measure.test.benchmark

import android.app.Application
import sh.measure.android.Measure

class MeasureEnabledApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Measure.init(this)
    }
}