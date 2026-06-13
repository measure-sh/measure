package sh.measure.android.logs

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify

@RunWith(AndroidJUnit4::class)
class MsrLogTest {
    private val collector: LogEventCollector = mock()

    @Test
    fun `track maps verbose and debug priorities to debug severity`() {
        MsrLog.track(collector, Log.VERBOSE, "tag", "message", null)
        MsrLog.track(collector, Log.DEBUG, "tag", "message", null)

        verify(collector, times(2)).trackLog(
            body = "tag: message",
            severity = LogSeverity.Debug,
            userTriggered = false,
        )
    }

    @Test
    fun `track maps priorities at info and above to severities`() {
        MsrLog.track(collector, Log.INFO, "tag", "message", null)
        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Info,
            userTriggered = false,
        )

        MsrLog.track(collector, Log.WARN, "tag", "message", null)
        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Warning,
            userTriggered = false,
        )

        MsrLog.track(collector, Log.ERROR, "tag", "message", null)
        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Error,
            userTriggered = false,
        )

        MsrLog.track(collector, Log.ASSERT, "tag", "message", null)
        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Fatal,
            userTriggered = false,
        )
    }

    @Test
    fun `track appends stack trace when throwable is present`() {
        val tr = IllegalStateException("boom")
        MsrLog.track(collector, Log.ERROR, "tag", "failed", tr)

        verify(collector).trackLog(
            body = "tag: failed\n${Log.getStackTraceString(tr).trimEnd()}",
            severity = LogSeverity.Error,
            userTriggered = false,
        )
    }

    @Test
    fun `buildMessage formats tag and message`() {
        assertEquals("tag: message", MsrLog.buildMessage("tag", "message", null))
        assertEquals("message", MsrLog.buildMessage(null, "message", null))
        assertEquals("message", MsrLog.buildMessage("", "message", null))
    }

    @Test
    fun `buildMessage uses stack trace as body when message is absent`() {
        val tr = IllegalStateException("boom")
        val stackTrace = Log.getStackTraceString(tr).trimEnd()
        assertEquals("tag: $stackTrace", MsrLog.buildMessage("tag", null, tr))
        assertEquals(stackTrace, MsrLog.buildMessage(null, null, tr))
    }

    @Test
    fun `buildMessage returns null when there is nothing to log`() {
        assertNull(MsrLog.buildMessage("tag", null, null))
        assertNull(MsrLog.buildMessage("tag", "", null))
        assertNull(MsrLog.buildMessage(null, null, null))
    }

    @Test
    fun `log methods are safe to call before SDK initialization`() {
        MsrLog.i("tag", "message")
        MsrLog.e("tag", "message", IllegalStateException("boom"))
        MsrLog.println(Log.INFO, "tag", "message")
    }
}
