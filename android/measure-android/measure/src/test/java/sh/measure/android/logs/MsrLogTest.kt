package sh.measure.android.logs

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.kotlin.whenever

@RunWith(AndroidJUnit4::class)
class MsrLogTest {
    private val collector: LogEventCollector = mock()

    @Before
    fun setup() {
        whenever(collector.isAutomaticCollectionEnabled).thenReturn(true)
    }

    @Test
    fun `track does not collect when automatic collection is disabled`() {
        whenever(collector.isAutomaticCollectionEnabled).thenReturn(false)

        MsrLog.track(collector, Log.INFO, "tag", "message")

        verify(collector, never()).trackLog(
            body = "tag: message",
            severity = LogSeverity.Info,
            userTriggered = false,
        )
    }

    @Test
    fun `track prefixes the body with the tag`() {
        MsrLog.track(collector, Log.INFO, "tag", "message")

        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Info,
            userTriggered = false,
        )
    }

    @Test
    fun `track uses the message as the body when the tag is null or empty`() {
        MsrLog.track(collector, Log.INFO, null, "message")
        MsrLog.track(collector, Log.INFO, "", "message")

        verify(collector, times(2)).trackLog(
            body = "message",
            severity = LogSeverity.Info,
            userTriggered = false,
        )
    }

    @Test
    fun `track maps verbose and debug priorities to debug severity`() {
        MsrLog.track(collector, Log.VERBOSE, "tag", "message")
        MsrLog.track(collector, Log.DEBUG, "tag", "message")

        verify(collector, times(2)).trackLog(
            body = "tag: message",
            severity = LogSeverity.Debug,
            userTriggered = false,
        )
    }

    @Test
    fun `track maps priorities at info and above to severities`() {
        MsrLog.track(collector, Log.INFO, "tag", "message")
        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Info,
            userTriggered = false,
        )

        MsrLog.track(collector, Log.WARN, "tag", "message")
        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Warning,
            userTriggered = false,
        )

        MsrLog.track(collector, Log.ERROR, "tag", "message")
        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Error,
            userTriggered = false,
        )
    }

    @Test
    fun `track maps assert priority to fatal severity`() {
        MsrLog.track(collector, Log.ASSERT, "tag", "message")

        verify(collector).trackLog(
            body = "tag: message",
            severity = LogSeverity.Fatal,
            userTriggered = false,
        )
    }

    @Test
    fun `track ignores the throwable and logs only the message`() {
        MsrLog.track(collector, Log.ERROR, "tag", "failed")

        verify(collector).trackLog(
            body = "tag: failed",
            severity = LogSeverity.Error,
            userTriggered = false,
        )
    }

    @Test
    fun `log methods are safe to call before SDK initialization`() {
        MsrLog.i("tag", "message")
        MsrLog.e("tag", "message", IllegalStateException("boom"))
        MsrLog.println(Log.INFO, "tag", "message")
    }
}
