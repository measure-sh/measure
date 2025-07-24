package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.ChecksSdkIntAtLeast
import androidx.annotation.RequiresApi
import androidx.annotation.VisibleForTesting
import okio.Buffer
import okio.BufferedSource
import okio.buffer
import okio.source
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.SystemServiceProvider
import java.io.InputStream

internal interface AppExitProvider {
    fun get(): Map<Int, AppExit>?
}

internal class AppExitProviderImpl(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
) : AppExitProvider {

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.R)
    override fun get(): Map<Int, AppExit>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return null
        }
        return systemServiceProvider.activityManager?.runCatching {
            getHistoricalProcessExitReasons(null, 0, 3).associateBy(
                { it.pid },
                { it.toAppExit() },
            )
        }?.getOrNull()
    }

    @RequiresApi(Build.VERSION_CODES.R)
    fun ApplicationExitInfo.toAppExit(): AppExit = AppExit(
        reason = getReasonName(reason),
        importance = getImportanceName(importance),
        trace = getTraceString(traceInputStream),
        process_name = processName,
        app_exit_time_ms = timestamp,
        pid = pid.toString(),
    )

    @VisibleForTesting
    internal fun getTraceString(traceInputStream: InputStream?): String? {
        if (traceInputStream == null) {
            return null
        }
        logger.log(LogLevel.Debug, "Adding AppExit trace")
        return traceInputStream.extractContent().bufferedReader().useLines { lines ->
            lines.joinToString("\n")
        }
    }

    private fun InputStream.extractContent(): InputStream {
        val source: BufferedSource = source().buffer()
        val buffer = Buffer()
        var insideSection = false
        while (!source.exhausted()) {
            val line = source.readUtf8Line() ?: break

            if (line.startsWith("DALVIK THREADS (")) {
                insideSection = true
            } else if (line.startsWith("----- Waiting Channels:")) {
                insideSection = false
            }

            if (insideSection) {
                if (line.startsWith("  | ")) {
                    continue
                }
                buffer.writeUtf8(line)
                buffer.writeUtf8("\n")
            }
        }
        return buffer.inputStream()
    }

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

    private fun getReasonName(reason: Int): String = when (reason) {
        ApplicationExitInfo.REASON_ANR -> "ANR"
        ApplicationExitInfo.REASON_CRASH -> "CRASH"
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE"
        ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
        ApplicationExitInfo.REASON_EXIT_SELF -> "EXIT_SELF"
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
        ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
        ApplicationExitInfo.REASON_OTHER -> "OTHER"
        ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED"
        ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_REQUESTED"
        ApplicationExitInfo.REASON_UNKNOWN -> "UNKNOWN"
        else -> "UNKNOWN"
    }
}
