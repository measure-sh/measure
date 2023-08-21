package sh.measure.sample

import android.app.Application

class SampleApplication: Application() {

    override fun onCreate() {
        super.onCreate()
        Measure.init(this)
    }
}