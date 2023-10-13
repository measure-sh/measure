package sh.measure.android.fakes

import sh.measure.android.appexit.AppExit
import sh.measure.android.appexit.AppExitProvider

internal class FakeAppExitProvider(private val appExit: AppExit? = null) : AppExitProvider {
    override fun get(pid: Int): AppExit? {
        return appExit
    }
}