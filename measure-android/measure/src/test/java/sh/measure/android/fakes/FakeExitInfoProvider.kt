package sh.measure.android.fakes

import sh.measure.android.exitinfo.ExitInfo
import sh.measure.android.exitinfo.ExitInfoProvider

internal class FakeExitInfoProvider(private val exitInfo: ExitInfo? = null) : ExitInfoProvider {
    override fun get(pid: Int): ExitInfo? {
        return exitInfo
    }
}