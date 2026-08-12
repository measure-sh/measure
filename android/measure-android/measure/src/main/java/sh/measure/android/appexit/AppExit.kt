package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.ChecksSdkIntAtLeast
import androidx.annotation.RequiresApi
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider

internal interface AppExit {
    /**
     * Returns exits worth reporting, keyed by the pid of the process that exited.
     */
    fun get(): Map<Int, AppExitData>?
}

internal class AppExitImpl(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
) : AppExit {

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.R)
    override fun get(): Map<Int, AppExitData>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return null
        }
        return systemServiceProvider.activityManager?.runCatching {
            getHistoricalProcessExitReasons(null, 0, 0)
                .filter { isReported(it.reason) }
                .associateBy({ it.pid }, { it.toAppExit() })
        }?.onFailure {
            logger.log(LogLevel.Debug, "Failed to read the system's exit records", it)
        }?.getOrNull()
    }

    /**
     * These are the deaths the SDK cannot observe as they happen, so the system's record
     * is the only account of them. An ANR, a crash and a signal are all left out because
     * the SDK reports each one itself, and reporting them here too would describe one
     * death twice. So are the ordinary exits, such as the user swiping the app away or a
     * package update, which say nothing about the app's health.
     */
    @RequiresApi(Build.VERSION_CODES.R)
    private fun isReported(reason: Int): Boolean = when (reason) {
        ApplicationExitInfo.REASON_LOW_MEMORY,
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE,
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE,
        ApplicationExitInfo.REASON_DEPENDENCY_DIED,
        -> true

        else -> false
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun ApplicationExitInfo.toAppExit(): AppExitData = AppExitData(
        reason = getReasonName(reason),
        importance = getImportanceName(importance),
        trace = null,
        process_name = processName,
        app_exit_time_ms = timestamp,
        pid = pid.toString(),
    )

    private fun getImportanceName(importance: Int): String = when (importance) {
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED -> "CACHED"
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_CANT_SAVE_STATE -> "CANT_SAVE_STATE"
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND -> "FOREGROUND"
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_GONE -> "GONE"
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_PERCEPTIBLE -> "PERCEPTIBLE"
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_SERVICE -> "SERVICE"
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_TOP_SLEEPING -> "TOP_SLEEPING"
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE -> "VISIBLE"
        else -> "UNKNOWN"
    }

    /**
     * Names the reasons [isReported] keeps, so the two stay in step.
     */
    @RequiresApi(Build.VERSION_CODES.R)
    private fun getReasonName(reason: Int): String = when (reason) {
        ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
        ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
        else -> "UNKNOWN"
    }
}
