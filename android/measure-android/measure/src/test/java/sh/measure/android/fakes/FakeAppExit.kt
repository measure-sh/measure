package sh.measure.android.fakes

import sh.measure.android.appexit.AppExit
import sh.measure.android.appexit.AppExitData

internal class FakeAppExit : AppExit {
    var appExits = mapOf(
        7654 to AppExitData(
            reason = "LOW_MEMORY",
            pid = 7654.toString(),
            trace = null,
            process_name = "com.example.app",
            importance = "FOREGROUND",
        ),
    )

    override fun get(): Map<Int, AppExitData> = appExits
}
