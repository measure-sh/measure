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

private const val THREAD_DUMP_START = "DALVIK THREADS ("
private const val THREAD_DUMP_END = "----- Waiting Channels:"
private const val THREAD_HEADER_PREFIX = "\""
private const val THREAD_DETAIL_PREFIX = "  | "
private const val SUBJECT_PREFIX = "Subject: "

/**
 * The largest thread dump the backend accepts. A dump of 40 threads is roughly
 * 40 KB, so only a process with an extreme number of threads reaches this.
 */
private const val MAX_THREAD_DUMP_BYTES = 1024 * 1024

/**
 * The parts of an ANR trace worth keeping: the thread dump and the system's one
 * line cause for the ANR.
 */
internal data class AnrTrace(val threadDump: String, val subject: String?)

internal interface AppExitProvider {
    /**
     * Returns exits caused by an ANR, keyed by the pid of the process that exited.
     * Exits for every other reason are dropped, so their traces are never read.
     */
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
            getHistoricalProcessExitReasons(null, 0, 0)
                .filter { it.reason == ApplicationExitInfo.REASON_ANR }
                .associateBy({ it.pid }, { it.toAppExit() })
        }?.getOrNull()
    }

    @RequiresApi(Build.VERSION_CODES.R)
    fun ApplicationExitInfo.toAppExit(): AppExit {
        val anrTrace = parseAnrTrace(traceInputStream)
        return AppExit(
            reason = getReasonName(reason),
            importance = getImportanceName(importance),
            trace = anrTrace?.threadDump,
            subject = anrTrace?.subject,
            process_name = processName,
            app_exit_time_ms = timestamp,
            pid = pid.toString(),
        )
    }

    /**
     * Reads the thread dump and the subject out of an ANR trace in a single pass, as
     * the stream can only be read once. Whole threads are accumulated and only
     * committed once they are known to fit, so a capped dump never ends mid thread.
     */
    @VisibleForTesting
    internal fun parseAnrTrace(traceInputStream: InputStream?): AnrTrace? {
        if (traceInputStream == null) {
            return null
        }
        logger.log(LogLevel.Debug, "Adding AppExit trace")
        val source: BufferedSource = traceInputStream.source().buffer()
        val dump = Buffer()
        val thread = Buffer()
        var subject: String? = null
        var insideDump = false

        fun commitThread(): Boolean {
            if (dump.size + thread.size > MAX_THREAD_DUMP_BYTES) {
                return false
            }
            dump.writeAll(thread)
            return true
        }

        while (!source.exhausted()) {
            val line = source.readUtf8Line() ?: break

            if (line.startsWith(THREAD_DUMP_START)) {
                insideDump = true
            } else if (line.startsWith(THREAD_DUMP_END)) {
                insideDump = false
            }

            if (!insideDump) {
                if (subject == null && line.startsWith(SUBJECT_PREFIX)) {
                    subject = line.removePrefix(SUBJECT_PREFIX).trim()
                }
                continue
            }
            if (line.startsWith(THREAD_DETAIL_PREFIX)) {
                continue
            }
            if (line.startsWith(THREAD_HEADER_PREFIX) && thread.size > 0 && !commitThread()) {
                break
            }
            thread.writeUtf8(line).writeUtf8("\n")
        }
        commitThread()
        return AnrTrace(dump.readUtf8().removeSuffix("\n"), subject)
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
