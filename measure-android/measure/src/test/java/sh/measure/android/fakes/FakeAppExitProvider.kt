package sh.measure.android.fakes

import sh.measure.android.appexit.AppExit
import sh.measure.android.appexit.AppExitProvider

internal class FakeAppExitProvider : AppExitProvider {
    var appExits = mapOf(
        7654 to AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = 7654,
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE"
        )
    )

    override fun get(): Map<Int, AppExit> {
        return appExits
    }
}
