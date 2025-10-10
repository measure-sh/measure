package sh.measure.android.exporter

import sh.measure.android.utils.Sleeper

class FakeSleeper : Sleeper {
    override fun sleep(ms: Long) {
        // do nothing
    }
}
