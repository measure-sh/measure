package sh.measure.android.fakes

import android.app.ActivityManager.RunningAppProcessInfo
import sh.measure.android.utils.ProcessInfoProvider

internal class FakeProcessInfoProvider(var id: Int = 0) : ProcessInfoProvider {
    @Suppress("MemberVisibilityCanBePrivate")
    var foregroundProcess = true
    override fun isForegroundProcess(): Boolean = foregroundProcess

    override fun getPid(): Int = id

    override fun getProcessImportance(): Int = RunningAppProcessInfo.IMPORTANCE_FOREGROUND
}
