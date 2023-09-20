package sh.measure.sample

import android.app.Application
import android.os.Build
import android.os.StrictMode
import android.os.StrictMode.ThreadPolicy
import sh.measure.android.Measure

class SampleApplication: Application() {

    override fun onCreate() {
        super.onCreate()
        Measure.init(this)
    }
}