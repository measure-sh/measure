package sh.measure.sample

import android.app.Application
import sh.measure.android.Measure

class SampleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Measure.init(this)
    }
}