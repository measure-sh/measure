package sh.measure.sample

import android.app.Application
import sh.measure.android.Measure

class SampleApplication: Application() {

    override fun onCreate() {
        super.onCreate()
        Measure.init(this)
    }
}