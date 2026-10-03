package sh.measure.android.appexit

import android.app.ApplicationExitInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeAppExitProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.storage.SessionRecord

private const val THREAD_DUMP = "DALVIK THREADS (1):\n\"main\" prio=5 tid=1 Blocked\n"
private const val SUBJECT = "Input dispatching timed out"

class AppExitCollectorTest {
    private val appExitProvider = FakeAppExitProvider()
    private val signalProcessor = mock<SignalProcessor>()
    private val sessionManager = FakeSessionManager()

    private val appExitCollector = AppExitCollector(
        NoopLogger(),
        appExitProvider,
        signalProcessor,
        sessionManager,
    )

    @Test
    fun `tracks an anr event for an anr exit with a session and a thread dump`() {
        val appExit = anrExit()
        appExitProvider.appExits = mapOf(1 to appExit)
        val session = getSession(1)
        sessionManager.appExitSessions[1] = session

        appExitCollector.collect()

        val data = argumentCaptor<ExceptionData>()
        verify(signalProcessor).trackAnr(
            data = data.capture(),
            timestamp = eq(appExit.app_exit_time_ms),
            threadName = eq("main"),
            sessionId = eq(session.id),
            sessionStartTime = eq(session.createdAt),
            appVersion = eq(session.appVersion),
            appBuild = eq(session.appBuild),
            isSampled = any(),
        )

        val tracked = data.firstValue
        assertTrue(tracked.exceptions.isEmpty())
        assertTrue(tracked.threads.isEmpty())
        assertEquals(THREAD_DUMP, tracked.art_thread_dump)
        assertEquals(SUBJECT, tracked.subject)
    }

    @Test
    fun `never emits an app exit event`() {
        appExitProvider.appExits = mapOf(1 to anrExit())
        sessionManager.appExitSessions[1] = getSession(1)

        appExitCollector.collect()

        verify(signalProcessor, never()).trackAppExit(
            any(),
            any(),
            any(),
            threadName = any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
            isSampled = any(),
        )
    }

    @Test
    fun `tracks an anr event for each session`() {
        val appExit1 = anrExit()
        val appExit2 = anrExit()
        val session1 =
            getSession(sessionId = "session-1", pid = 1, appVersion = "1.1.1", appBuild = "111")
        val session2 =
            getSession(sessionId = "session-2", pid = 2, appVersion = "1.1.2", appBuild = "112")

        appExitProvider.appExits = mapOf(1 to appExit1, 2 to appExit2)
        sessionManager.appExitSessions[1] = session1
        sessionManager.appExitSessions[2] = session2

        appExitCollector.collect()

        for (session in listOf(session1, session2)) {
            verify(signalProcessor).trackAnr(
                data = any(),
                timestamp = any(),
                threadName = eq("main"),
                sessionId = eq(session.id),
                sessionStartTime = eq(session.createdAt),
                appVersion = eq(session.appVersion),
                appBuild = eq(session.appBuild),
                isSampled = any(),
            )
        }
    }

    @Test
    fun `reports foreground from the exit importance`() {
        appExitProvider.appExits = mapOf(
            1 to anrExit(importance = "VISIBLE"),
            2 to anrExit(importance = "CACHED"),
        )
        sessionManager.appExitSessions[1] = getSession(sessionId = "session-1", pid = 1)
        sessionManager.appExitSessions[2] = getSession(sessionId = "session-2", pid = 2)

        appExitCollector.collect()

        val data = argumentCaptor<ExceptionData>()
        verify(signalProcessor, times(2)).trackAnr(
            data = data.capture(),
            timestamp = any(),
            threadName = any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
            isSampled = any(),
        )

        assertTrue(data.allValues.any { it.foreground })
        assertTrue(data.allValues.any { !it.foreground })
    }

    @Test
    fun `does not track an anr exit whose trace could not be read`() {
        appExitProvider.appExits = mapOf(1 to anrExit(trace = null))
        sessionManager.appExitSessions[1] = getSession(1)

        appExitCollector.collect()

        verifyNothingTracked()
    }

    @Test
    fun `does not track an anr exit without a matching session`() {
        appExitProvider.appExits = mapOf(1 to anrExit())

        appExitCollector.collect()

        verifyNothingTracked()
    }

    @Test
    fun `does not track a non anr exit`() {
        appExitProvider.appExits =
            mapOf(1 to anrExit(reasonId = ApplicationExitInfo.REASON_CRASH))
        sessionManager.appExitSessions[1] = getSession(1)

        appExitCollector.collect()

        verifyNothingTracked()
        assertFalse(sessionManager.markedAnrSessions.isNotEmpty())
    }

    @Test
    fun `marks sessions as app exit tracked after collection`() {
        appExitProvider.appExits = mapOf(1 to anrExit(), 2 to anrExit())
        sessionManager.appExitSessions[1] = getSession(sessionId = "session-1", pid = 1)
        sessionManager.appExitSessions[2] = getSession(sessionId = "session-2", pid = 2)

        appExitCollector.collect()

        assertEquals(1, sessionManager.appExitTrackedCount)
    }

    private fun verifyNothingTracked() {
        verify(signalProcessor, never()).trackAnr(
            data = any(),
            timestamp = any(),
            threadName = any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
            isSampled = any(),
        )
    }

    private fun anrExit(
        reasonId: Int = ApplicationExitInfo.REASON_ANR,
        trace: String? = THREAD_DUMP,
        importance: String = "FOREGROUND",
    ) = TestData.getAppExit(
        reasonId = reasonId,
        trace = trace,
        subject = SUBJECT,
        importance = importance,
    )

    private fun getSession(
        pid: Int,
        sessionId: String = "session-id-1",
        createdAt: Long = 98765,
        appVersion: String = "1.0.0",
        appBuild: String = "1000",
    ) = SessionRecord(
        id = sessionId,
        createdAt = createdAt,
        appVersion = appVersion,
        appBuild = appBuild,
    )
}
