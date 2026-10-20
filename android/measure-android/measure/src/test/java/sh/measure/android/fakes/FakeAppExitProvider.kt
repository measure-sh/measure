package sh.measure.android.fakes

import sh.measure.android.appexit.AppExit
import sh.measure.android.appexit.AppExitProvider

internal class FakeAppExitProvider : AppExitProvider {
    var appExits: List<AppExit> = emptyList()

    override fun get(): List<AppExit> = appExits
}
