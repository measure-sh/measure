package sh.measure.android.anr

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.robolectric.annotation.Config
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.utils.SystemServiceProvider
import java.io.ByteArrayInputStream
import java.io.InputStream

/**
 * Every sample here comes from `anr_trace_raw.txt`, an ANR trace the system
 * recorded for the sample app, so the parser is held against the shapes a real
 * dump has rather than the ones it is assumed to have.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [Build.VERSION_CODES.R])
class AnrTraceTest {
    private val systemServiceProvider: SystemServiceProvider = mock()
    private val activityManager: ActivityManager = mock()
    private val anrExit = AnrExitImpl(NoopLogger(), systemServiceProvider)
    private val rawTrace = TestData.rawAnrTrace()

    @Before
    fun setup() {
        `when`(systemServiceProvider.activityManager).thenReturn(activityManager)
    }

    @Test
    fun `keeps every thread and drops the runtime stats that follow them`() {
        val result = readTrace(rawTrace)

        assertEquals(expectedDumpOf(rawTrace), result.threadDump)
        assertEquals(
            "Broadcast of Intent { flg=0x10000010 xflg=0x4 " +
                "cmp=sh.frankenstein.android/.AnrBroadcastReceiver }",
            result.subject,
        )
    }

    @Test
    fun `returns no thread dump when the system kept no trace`() {
        val result = readTrace(null as InputStream?)

        assertNull(result.threadDump)
        assertNull(result.subject)
    }

    @Test
    fun `keeps the last frame of a trace that was cut short`() {
        val cutTrace = rawTrace.substringBefore("DumpLatencyMs:").trimEnd('\n')

        val result = readTrace(cutTrace)

        assertEquals(expectedDumpOf(cutTrace), result.threadDump)
    }

    @Test
    fun `closes the trace once the dump ends`() {
        val stream = ClosableTrace(rawTrace)

        readTrace(stream)

        assertTrue(stream.closed)
    }

    @Test
    fun `stops on a thread boundary when the dump exceeds the size limit`() {
        val threads = rawTrace.substring(
            rawTrace.indexOf('\n', rawTrace.indexOf(DUMP_START)) + 1,
            rawTrace.indexOf(RUNTIME_STATS_START),
        )
        val longTrace = DUMP_START + "1230):\n" + threads.repeat(30)

        val threadDump = readTrace(longTrace).threadDump!!

        assertTrue(threadDump.length <= 1024 * 1024)
        val withoutThreadDetails = longTrace.lines()
            .filterNot { it.startsWith(THREAD_DETAIL_PREFIX) }
            .joinToString("\n")
        assertTrue(withoutThreadDetails.startsWith(threadDump))
        // What follows the cut is the blank line closing the last thread kept,
        // then the header of the thread that did not fit.
        assertEquals('\n', withoutThreadDetails[threadDump.length])
        assertEquals('"', withoutThreadDetails[threadDump.length + 1])
    }

    private fun readTrace(trace: String): AnrExitData = readTrace(ByteArrayInputStream(trace.toByteArray()))

    /**
     * Reads [traceStream] the way the SDK does, through the exit record the system
     * holds the trace against.
     */
    private fun readTrace(traceStream: InputStream?): AnrExitData {
        val exitInfo = mock(ApplicationExitInfo::class.java).apply {
            `when`(this.pid).thenReturn(EXIT_PID)
            `when`(this.reason).thenReturn(ApplicationExitInfo.REASON_ANR)
            `when`(this.timestamp).thenReturn(EXIT_TIMESTAMP)
            `when`(this.traceInputStream).thenReturn(traceStream)
        }
        `when`(activityManager.getHistoricalProcessExitReasons(null, EXIT_PID, 0))
            .thenReturn(listOf(exitInfo))
        return anrExit.withTrace(
            TestData.getAnrExit(
                pid = EXIT_PID,
                timestampMs = EXIT_TIMESTAMP,
                threadDump = null,
            ),
        )
    }

    /**
     * The dump the parser is expected to return: every line of the trace from the
     * thread list to the runtime's stats, less the thread details.
     */
    private fun expectedDumpOf(trace: String): String {
        val lines = trace.lines()
        val start = lines.indexOfFirst { it.startsWith(DUMP_START) }
        val end = lines.indexOfFirst { it.startsWith(RUNTIME_STATS_START) }
        return lines.subList(start, if (end == -1) lines.size else end)
            .filterNot { it.startsWith(THREAD_DETAIL_PREFIX) }
            .joinToString("\n")
    }

    private class ClosableTrace(text: String) : ByteArrayInputStream(text.toByteArray()) {
        var closed = false

        override fun close() {
            closed = true
            super.close()
        }
    }
}

private const val EXIT_PID = 12894
private const val EXIT_TIMESTAMP = 1234567890L
private const val DUMP_START = "DALVIK THREADS ("
private const val RUNTIME_STATS_START = "Zygote loaded classes="
private const val THREAD_DETAIL_PREFIX = "  | "
