package sh.measure.android.exporter

import sh.measure.android.utils.Sleeper

class FakeSleeper : Sleeper {
    val sleepCalls = mutableListOf<Long>()

    override fun sleep(ms: Long) {
        sleepCalls.add(ms)
    }
}
