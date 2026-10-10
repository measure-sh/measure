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
import sh.measure.android.utils.ValidationLimits
import java.io.InputStream

internal interface AppExitProvider {
    fun get(): Map<Int, AppExit>?
}

internal data class ArtTrace(
    val threads: String,
    val subject: String?,
)

private const val THREAD_SECTION_HEADER = "DALVIK THREADS ("
private const val SUBJECT_PREFIX = "Subject: "
private const val SCHEDULER_PREFIX = "  | "
private const val DUMP_LATENCY_PREFIX = "DumpLatencyMs:"
private const val MAX_TRACE_BYTES = 256 * 1024
private val THREAD_HEADER_REGEX = Regex("""^"(.*)" (?:daemon )?prio=\d+(?: tid=(\d+))?""")
private val MANAGED_FRAME_REGEX = Regex("""^  at [\w$.\-]+\.[\w$\-<>]+\(.*\)$""")

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
        val trace = readTrace(traceInputStream)
        return AppExit(
            reason = getReasonName(reason),
            reasonId = reason,
            importance = getImportanceName(importance),
            trace = trace?.threads,
            subject = (trace?.subject ?: description?.takeIf { it.isNotBlank() })
                ?.take(ValidationLimits.ANR_SUBJECT),
            process_name = processName,
            app_exit_time_ms = timestamp,
            pid = pid.toString(),
        )
    }

    /**
     * Reads the thread blocks and the subject out of an ART trace.
     */
    @VisibleForTesting
    internal fun readTrace(traceInputStream: InputStream?): ArtTrace? {
        if (traceInputStream == null) {
            return null
        }
        return traceInputStream.source().buffer().use { source ->
            readTrace(source)
        }
    }

    private fun readTrace(source: BufferedSource): ArtTrace? {
        val buffer = Buffer()
        var subject: String? = null
        var insideSection = false

        while (!source.exhausted()) {
            val line = source.readUtf8Line() ?: break

            if (!insideSection) {
                if (subject == null && line.startsWith(SUBJECT_PREFIX)) {
                    subject = line.removePrefix(SUBJECT_PREFIX).trim()
                }
                if (line.startsWith(THREAD_SECTION_HEADER)) {
                    insideSection = true
                    buffer.writeUtf8(line).writeUtf8("\n")
                }
                continue
            }

            if (isThreadHeader(line)) {
                if (buffer.size >= MAX_TRACE_BYTES) {
                    break
                }
            } else if (endsThreadSection(line)) {
                break
            }

            if (line.startsWith(SCHEDULER_PREFIX)) {
                continue
            }

            buffer.writeUtf8(line).writeUtf8("\n")
        }

        if (!insideSection) {
            return null
        }

        val threads = buffer.readUtf8().trimEnd('\n') + "\n"

        if (!hasMainFrame(threads)) {
            return null
        }

        return ArtTrace(threads = threads, subject = subject)
    }

    /**
     * Returns true if the main thread, found by name or else by tid 1, has a
     * managed frame. The server groups the ANR on that frame and rejects a
     * trace without one.
     */
    private fun hasMainFrame(threads: String): Boolean {
        var foundMain = false
        var inMain = false
        var inTid1 = false
        var mainHasFrame = false
        var tid1HasFrame = false

        threads.lineSequence().forEach { line ->
            val header = THREAD_HEADER_REGEX.find(line)
            if (header != null) {
                inMain = !foundMain && header.groupValues[1] == "main"
                foundMain = foundMain || inMain
                inTid1 = header.groupValues[2] == "1"
            } else if (MANAGED_FRAME_REGEX.matches(line)) {
                mainHasFrame = mainHasFrame || inMain
                tid1HasFrame = tid1HasFrame || inTid1
            }
        }

        return if (foundMain) mainHasFrame else tid1HasFrame
    }

    private fun isThreadHeader(line: String): Boolean = line.startsWith("\"")

    private fun endsThreadSection(line: String): Boolean = line.isNotEmpty() &&
        !line.startsWith(" ") &&
        !isThreadHeader(line) &&
        !line.startsWith(DUMP_LATENCY_PREFIX)

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
