package sh.measure.android.fakes

import android.app.ActivityManager.RunningAppProcessInfo
import sh.measure.android.utils.ProcessInfoProvider

internal class FakeProcessInfoProvider(var id: Int = 0) : ProcessInfoProvider {
    var importance = RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    @Suppress("MemberVisibilityCanBePrivate")
    var foregroundProcess = true
    override fun isForegroundProcess(): Boolean = foregroundProcess

    override fun getPid(): Int = id

    override fun getProcessImportance(): Int = importance
}
