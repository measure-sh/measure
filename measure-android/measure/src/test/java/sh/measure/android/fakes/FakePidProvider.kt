package sh.measure.android.fakes

import sh.measure.android.utils.PidProvider

internal class FakePidProvider(var id: Int = 0) : PidProvider {
    override fun getPid(): Int {
        return id
    }
}
