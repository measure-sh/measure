package sh.measure.android.appexit

import org.junit.Assert.assertEquals
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
import sh.measure.android.exceptions.ExceptionSeverity
import sh.measure.android.fakes.FakeAppExitProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.nativecrash.NativeCrashFactory
import sh.measure.android.nativecrash.Tombstone
import sh.measure.android.nativecrash.TombstoneFrame
import sh.measure.android.nativecrash.TombstoneSignal
import sh.measure.android.nativecrash.TombstoneThread
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
        NativeCrashFactory("sh.frankenstein.android.debug"),
    )

    @Test
    fun `tracks an anr event for an anr exit with a session and a thread dump`() {
        val appExit = anrExit()
        appExitProvider.appExits = listOf(appExit)
        val session = getSession(1)
        sessionManager.appExitSessions[1] = session

        appExitCollector.collect()

        val data = argumentCaptor<ExceptionData>()
        verify(signalProcessor).trackAnr(
            data = data.capture(),
            timestamp = eq(appExit.timestamp),
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
    fun `tracks an anr event for each session`() {
        val appExit1 = anrExit(pid = 1)
        val appExit2 = anrExit(pid = 2)
        val session1 =
            getSession(sessionId = "session-1", pid = 1, appVersion = "1.1.1", appBuild = "111")
        val session2 =
            getSession(sessionId = "session-2", pid = 2, appVersion = "1.1.2", appBuild = "112")

        appExitProvider.appExits = listOf(appExit1, appExit2)
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
    fun `reports whether the exit was in the foreground`() {
        appExitProvider.appExits = listOf(
            anrExit(pid = 1, foreground = true),
            anrExit(pid = 2, foreground = false),
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
    fun `does not track an anr exit without a matching session`() {
        appExitProvider.appExits = listOf(anrExit())

        appExitCollector.collect()

        verifyNothingTracked()
    }

    @Test
    fun `tracks a native crash for a native crash exit with a session`() {
        val appExit = nativeCrashExit()
        appExitProvider.appExits = listOf(appExit)
        val session = getSession(1)
        sessionManager.appExitSessions[1] = session

        appExitCollector.collect()

        val data = argumentCaptor<ExceptionData>()
        verify(signalProcessor).trackNativeCrash(
            data = data.capture(),
            timestamp = eq(appExit.timestamp),
            threadName = eq("crash-thread"),
            sessionId = eq(session.id),
            sessionStartTime = eq(session.createdAt),
            appVersion = eq(session.appVersion),
            appBuild = eq(session.appBuild),
        )
        assertEquals("ndk", data.firstValue.framework)
        assertEquals("SIGSEGV", data.firstValue.exceptions.single().type)
        assertEquals(ExceptionSeverity.Fatal, data.firstValue.severity)
    }

    @Test
    fun `tracks a recoverable native crash as unhandled`() {
        appExitProvider.appExits = listOf(nativeCrashExit(recoverable = true))
        sessionManager.appExitSessions[1] = getSession(1)

        appExitCollector.collect()

        val data = argumentCaptor<ExceptionData>()
        verify(signalProcessor).trackNativeCrash(
            data = data.capture(),
            timestamp = any(),
            threadName = any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
        )
        assertEquals(ExceptionSeverity.Unhandled, data.firstValue.severity)
    }

    @Test
    fun `tracks a recoverable error and a later crash of the same process`() {
        appExitProvider.appExits = listOf(nativeCrashExit(), nativeCrashExit(recoverable = true))
        sessionManager.appExitSessions[1] = getSession(1)

        appExitCollector.collect()

        val data = argumentCaptor<ExceptionData>()
        verify(signalProcessor, times(2)).trackNativeCrash(
            data = data.capture(),
            timestamp = any(),
            threadName = any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
        )
        assertEquals(listOf(ExceptionSeverity.Fatal, ExceptionSeverity.Unhandled), data.allValues.map { it.severity })
    }

    @Test
    fun `does not track a native crash exit without a matching session`() {
        appExitProvider.appExits = listOf(nativeCrashExit())

        appExitCollector.collect()

        verifyNoNativeCrashTracked()
    }

    @Test
    fun `marks sessions as app exit tracked after collection`() {
        appExitProvider.appExits = listOf(anrExit(pid = 1), anrExit(pid = 2))
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

    private fun verifyNoNativeCrashTracked() {
        verify(signalProcessor, never()).trackNativeCrash(
            data = any(),
            timestamp = any(),
            threadName = any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
        )
    }

    private fun nativeCrashExit(recoverable: Boolean = false) = AppExit.NativeCrash(
        pid = 1,
        timestamp = 987654321L,
        foreground = true,
        tombstone = tombstone(),
        recoverable = recoverable,
    )

    private fun tombstone() = Tombstone(
        arch = "arm64",
        pid = 1,
        tid = 2,
        signal = TombstoneSignal(name = "SIGSEGV", codeName = "SEGV_MAPERR", faultAddress = 0),
        abortMessage = null,
        causes = emptyList(),
        memoryError = null,
        threads = mapOf(
            2 to TombstoneThread(
                id = 2,
                name = "crash-thread",
                frames = listOf(
                    TombstoneFrame(
                        relPc = 0x10,
                        pc = 0x1010,
                        functionName = null,
                        fileName = "/data/app/lib/arm64/libfoo.so",
                        buildId = "abc",
                    ),
                ),
            ),
        ),
        mappings = emptyList(),
    )

    private fun anrExit(pid: Int = 1, foreground: Boolean = true) = AppExit.Anr(
        pid = pid,
        timestamp = 987654321L,
        foreground = foreground,
        trace = THREAD_DUMP,
        subject = SUBJECT,
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
