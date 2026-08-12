package sh.measure.android.anr

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.ChecksSdkIntAtLeast
import androidx.annotation.RequiresApi
import okio.Buffer
import okio.ByteString.Companion.encodeUtf8
import okio.buffer
import okio.source
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.SystemServiceProvider
import java.io.InputStream

private const val SUBJECT_PREFIX = "Subject: "
private val NEWLINE = '\n'.code.toByte()
private val THREAD_DUMP_START = "DALVIK THREADS (".encodeUtf8()
private val THREAD_HEADER_PREFIX = "\"".encodeUtf8()
private val THREAD_DETAIL_PREFIX = "  | ".encodeUtf8()
private val SUBJECT_PREFIX_BYTES = SUBJECT_PREFIX.encodeUtf8()
private val BLANK_LINE = "\n".encodeUtf8()

/**
 * The largest thread dump the backend accepts. A dump of 40 threads is roughly
 * 40 KB, so only a process with an extreme number of threads reaches this.
 */
private const val MAX_THREAD_DUMP_BYTES = 1024 * 1024

internal interface AnrExit {
    /**
     * Returns exits caused by an ANR, without their traces. Exits for every other
     * reason are dropped.
     */
    fun get(): List<AnrExitData>?

    /**
     * Returns [exit] with the thread dump and the reason read from the trace the
     * system recorded for it.
     */
    fun withTrace(exit: AnrExitData): AnrExitData
}

internal class AnrExitImpl(
    private val logger: Logger,
    private val systemServiceProvider: SystemServiceProvider,
) : AnrExit {

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.R)
    override fun get(): List<AnrExitData>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return null
        }
        return InternalTrace.trace(
            { "msr-read-exit-records" },
            {
                systemServiceProvider.activityManager?.runCatching {
                    getHistoricalProcessExitReasons(null, 0, 0)
                        .filter { it.reason == ApplicationExitInfo.REASON_ANR }
                        .map { it.toAnrExitData() }
                }?.onFailure {
                    logger.log(LogLevel.Debug, "Failed to read the system's exit records", it)
                }?.getOrNull()
            },
        )
    }

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.R)
    override fun withTrace(exit: AnrExitData): AnrExitData {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return exit
        }
        return InternalTrace.trace(
            { "msr-read-anr-trace" },
            {
                systemServiceProvider.activityManager?.runCatching {
                    val record = getHistoricalProcessExitReasons(null, exit.pid, 0).firstOrNull {
                        it.reason == ApplicationExitInfo.REASON_ANR &&
                            it.timestamp == exit.timestampMs
                    }
                    exit.readTrace(record?.traceInputStream)
                }?.onFailure {
                    logger.log(LogLevel.Debug, "Failed to read the ANR trace", it)
                }?.getOrDefault(exit) ?: exit
            },
        )
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun ApplicationExitInfo.toAnrExitData(): AnrExitData = AnrExitData(
        pid = pid,
        timestampMs = timestamp,
        threadDump = null,
        subject = null,
        foreground = importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND,
    )

    /**
     * Reads the thread dump and the `Subject:` line.
     *
     * The trace has three parts: a header, the list of threads, and the runtime's
     * stats for the process.
     *
     * The subject is one of the header lines, the rest of the header is skipped.
     *
     * The list of threads starts at `DALVIK THREADS (` and is kept until the first
     * line that is not part of a thread, which is where the stats start.
     *
     * A thread starts with its name and ends at a blank line. The frames in between
     * are kept, the `  | ` lines with scheduler state and stack addresses are
     * skipped.
     *
     * The stream can only be read once, so this is a single pass that copies lines
     * as bytes without decoding them.
     *
     * Each thread is buffered and added to the dump only once it fits under
     * [MAX_THREAD_DUMP_BYTES], so a dump that hits the limit ends at a thread
     * boundary.
     */
    private fun AnrExitData.readTrace(traceInputStream: InputStream?): AnrExitData {
        if (traceInputStream == null) {
            return this
        }
        val dump = Buffer()
        val thread = Buffer()
        var subject: String? = null
        var insideDump = false
        var insideThread = false

        fun commitThread(): Boolean {
            if (dump.size + thread.size > MAX_THREAD_DUMP_BYTES) {
                return false
            }
            dump.writeAll(thread)
            return true
        }

        traceInputStream.source().buffer().use { source ->
            while (!source.exhausted()) {
                val newline = source.indexOf(NEWLINE)
                val lineLength = if (newline == -1L) source.buffer.size else newline + 1

                if (!insideDump) {
                    if (source.rangeEquals(0, THREAD_DUMP_START)) {
                        insideDump = true
                        thread.write(source, lineLength)
                    } else if (subject == null && source.rangeEquals(0, SUBJECT_PREFIX_BYTES)) {
                        subject = source.readUtf8(lineLength).removePrefix(SUBJECT_PREFIX).trim()
                    } else {
                        source.skip(lineLength)
                    }
                    continue
                }

                val threadHeader = source.rangeEquals(0, THREAD_HEADER_PREFIX)
                if (threadHeader) {
                    insideThread = true
                } else if (source.rangeEquals(0, BLANK_LINE)) {
                    insideThread = false
                } else if (!insideThread) {
                    break
                }

                if (source.rangeEquals(0, THREAD_DETAIL_PREFIX)) {
                    source.skip(lineLength)
                    continue
                }
                if (threadHeader && thread.size > 0 && !commitThread()) {
                    break
                }
                thread.write(source, lineLength)
                if (dump.size + thread.size > MAX_THREAD_DUMP_BYTES) {
                    break
                }
            }
        }
        commitThread()
        val threadDump = if (dump.size > 0 && dump[dump.size - 1] == NEWLINE) {
            dump.readUtf8(dump.size - 1)
        } else {
            dump.readUtf8()
        }
        return copy(threadDump = threadDump, subject = subject)
    }
}
