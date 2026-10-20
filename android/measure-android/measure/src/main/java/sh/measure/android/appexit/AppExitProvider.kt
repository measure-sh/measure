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
import sh.measure.android.nativecrash.TombstoneParser
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.ValidationLimits
import java.io.InputStream

internal interface AppExitProvider {
    fun get(): List<AppExit>?
}

internal data class ArtTrace(
    val threads: String,
    val subject: String?,
)

private const val THREAD_SECTION_HEADER = "DALVIK THREADS ("
private const val SUBJECT_PREFIX = "Subject: "
private const val SCHEDULER_PREFIX = "  | "
private const val DUMP_LATENCY_PREFIX = "DumpLatencyMs:"

// The OS records an error that the process recovered from as a native crash
// with this description, while the process keeps running.
private const val RECOVERABLE_CRASH_DESCRIPTION = "recoverable_crash"
private const val MAX_TRACE_BYTES = 256 * 1024
private val THREAD_HEADER_REGEX = Regex("""^"(.*)" (?:daemon )?prio=\d+(?: tid=(\d+))?""")
private val MANAGED_FRAME_REGEX = Regex("""^  at [\w$.\-]+\.[\w$\-<>]+\(.*\)$""")

internal class AppExitProviderImpl(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
    private val nativeCrashReporting: Boolean,
) : AppExitProvider {

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.R)
    override fun get(): List<AppExit>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return null
        }
        return systemServiceProvider.activityManager?.runCatching {
            getHistoricalProcessExitReasons(null, 0, 5)
                .mapNotNull { it.toAppExit() }
        }?.getOrNull()
    }

    @RequiresApi(Build.VERSION_CODES.R)
    fun ApplicationExitInfo.toAppExit(): AppExit? = when (reason) {
        ApplicationExitInfo.REASON_ANR -> toAnr()
        ApplicationExitInfo.REASON_CRASH_NATIVE -> if (canReportNativeCrash()) toNativeCrash() else null
        else -> null
    }

    /**
     * The OS attaches a tombstone to native crash exits only from Android 12.
     */
    private fun canReportNativeCrash(): Boolean = nativeCrashReporting && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    @RequiresApi(Build.VERSION_CODES.R)
    private fun ApplicationExitInfo.toAnr(): AppExit.Anr? {
        val trace = readTrace(traceInputStream)
        if (trace == null) {
            logger.log(LogLevel.Debug, "Discarding ANR exit for pid $pid, failed to read thread dump")
            return null
        }
        return AppExit.Anr(
            pid = pid,
            timestamp = timestamp,
            foreground = isForeground(),
            trace = trace.threads,
            subject = (trace.subject ?: description?.takeIf { it.isNotBlank() })
                ?.take(ValidationLimits.ANR_SUBJECT),
        )
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun ApplicationExitInfo.toNativeCrash(): AppExit.NativeCrash? {
        val input = traceInputStream
        if (input == null) {
            logger.log(LogLevel.Debug, "Discarding native crash for pid $pid, no tombstone available")
            return null
        }
        val tombstone = TombstoneParser.parse(input)
        if (tombstone == null) {
            logger.log(LogLevel.Debug, "Discarding native crash for pid $pid, failed to parse tombstone")
            return null
        }
        return AppExit.NativeCrash(
            pid = pid,
            timestamp = timestamp,
            foreground = isForeground(),
            tombstone = tombstone,
            recoverable = description == RECOVERABLE_CRASH_DESCRIPTION,
        )
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun ApplicationExitInfo.isForeground(): Boolean = importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND ||
        importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE

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
}
