package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.ChecksSdkIntAtLeast
import androidx.annotation.RequiresApi
import androidx.annotation.VisibleForTesting
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

/**
 * The trace [ApplicationExitInfo] carries for an exit, split into the
 * system's one line cause and the thread dump it precedes.
 */
internal data class SystemTrace(val subject: String?, val threadDump: String) {
    fun combined(): String = if (subject != null) "Subject: $subject\n\n$threadDump" else threadDump
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
    fun ApplicationExitInfo.toAppExit(): AppExit {
        val trace = parseTrace(traceInputStream)
        return AppExit(
            reason = getReasonName(reason),
            reasonId = reason,
            importance = getImportanceName(importance),
            trace = trace?.combined(),
            subject = trace?.subject,
            threadDump = trace?.threadDump,
            process_name = processName,
            app_exit_time_ms = timestamp,
            pid = pid.toString(),
        )
    }

    @VisibleForTesting
    internal fun parseTrace(traceInputStream: InputStream?): SystemTrace? {
        if (traceInputStream == null) {
            return null
        }
        val trace = runCatching {
            traceInputStream.source().buffer().use { it.readSystemTrace() }
        }.getOrNull()
        if (trace == null) {
            logger.log(LogLevel.Debug, "Discarding AppExit trace with unexpected structure")
        } else {
            logger.log(LogLevel.Debug, "Adding AppExit trace")
        }
        return trace
    }

    private fun BufferedSource.readSystemTrace(): SystemTrace? {
        val dump = StringBuilder()
        var subject: String? = null
        var insideDump = false
        var hasThreadHeader = false
        var hasFrame = false
        var pendingBlankLines = 0

        while (true) {
            val line = readUtf8Line() ?: break

            if (!insideDump) {
                // The subject line names what the system was waiting on.
                if (subject == null && line.startsWith("Subject: ")) {
                    subject = line.removePrefix("Subject: ")
                }
                if (line.startsWith("DALVIK THREADS (")) {
                    insideDump = true
                    dump.append(line).append('\n')
                }
                continue
            }

            if (line.startsWith("----- end") ||
                line.startsWith("----- Waiting Channels:") ||
                line.startsWith("Zygote loaded classes=")
            ) {
                break
            }

            val indent = line.indexOfFirst { !it.isWhitespace() }
            if (indent < 0) {
                // Held back, so blank lines trailing the dump never reach the output.
                pendingBlankLines++
                continue
            }
            if (line.startsWith("  | ") || line.startsWith("DumpLatencyMs:", indent)) {
                continue
            }

            repeat(pendingBlankLines) { dump.append('\n') }
            pendingBlankLines = 0

            if (line.startsWith("\"")) {
                hasThreadHeader = true
            } else if (line.startsWith("at ", indent)) {
                hasFrame = true
            }
            dump.append(line).append('\n')
        }

        if (!hasThreadHeader || !hasFrame) {
            return null
        }
        dump.setLength(dump.length - 1)
        return SystemTrace(subject, dump.toString())
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
