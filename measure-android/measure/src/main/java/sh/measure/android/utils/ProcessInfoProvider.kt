package sh.measure.android.utils

import android.app.ActivityManager
import android.os.Process

internal interface ProcessInfoProvider {
    /**
     * Returns true if the current process is in the foreground, false otherwise.
     */
    fun isForegroundProcess(): Boolean

    /**
     * Returns the PID of the current process.
     */
    fun getPid(): Int
}

internal class ProcessInfoProviderImpl : ProcessInfoProvider {
    override fun isForegroundProcess(): Boolean {
        val processInfo = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(processInfo)
        return processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }

    override fun getPid(): Int {
        return Process.myPid()
    }
}
