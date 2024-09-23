package sh.measure.android.fakes

import android.app.ActivityManager.RunningAppProcessInfo
import sh.measure.android.utils.ProcessInfoProvider

internal class FakeProcessInfoProvider(var id: Int = 0) : ProcessInfoProvider {
    @Suppress("MemberVisibilityCanBePrivate")
    var foregroundProcess = true
    override fun isForegroundProcess(): Boolean {
        return foregroundProcess
    }

    override fun getPid(): Int {
        return id
    }

    override fun getProcessImportance(): Int {
        return RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }
}
