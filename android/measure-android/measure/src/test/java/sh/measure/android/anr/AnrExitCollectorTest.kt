package sh.measure.android.anr

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeAnrExit
import sh.measure.android.fakes.FakeDraftAnrStore
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.ThreadDumpMerge
import sh.measure.android.storage.DraftAnr
import sh.measure.android.storage.SessionRecord

class AnrExitCollectorTest {
    private val anrExit = FakeAnrExit()
    private val draftAnrStore = FakeDraftAnrStore()
    private val signalProcessor = mock<SignalProcessor>()
    private val sessionManager = FakeSessionManager()
    private val processInfo = FakeProcessInfoProvider(id = 999)

    private val anrExitCollector = AnrExitCollector(
        anrExit,
        draftAnrStore,
        signalProcessor,
        sessionManager,
        processInfo,
    )

    @Test
    fun `given session is available for given pid, tracks an anr for it`() {
        // Given
        val pid = 1
        val exit = TestData.getAnrExit(
            pid = pid,
            threadDump = "DALVIK THREADS (1):",
            subject = "Input dispatching timed out",
            foreground = true,
        )
        anrExit.anrExits = listOf(exit)
        val session = getSession(pid)
        sessionManager.appExitSessions[pid] = session

        // When
        anrExitCollector.collect()

        // Then
        verify(signalProcessor).trackForSession(
            eq(
                ExceptionData(
                    exceptions = emptyList(),
                    threads = emptyList(),
                    foreground = true,
                    art_thread_dump = "DALVIK THREADS (1):",
                    subject = "Input dispatching timed out",
                ),
            ),
            eq(exit.timestampMs),
            eq(EventType.ANR),
            sessionId = eq(session.id),
            sessionStartTime = eq(session.createdAt),
            appVersion = eq("1.0.0"),
            appBuild = eq("1000"),
            attachments = any(),
            threadName = any(),
            isSampled = any(),
        )
        assertEquals(
            session.id to exit.timestampMs,
            sessionManager.markedAnrSessions.single(),
        )
    }

    @Test
    fun `given multiple sessions are available, tracks an anr for each of them`() {
        // Given
        val exit1 = TestData.getAnrExit(pid = 1)
        val session1 =
            getSession(sessionId = "session-1", pid = 1, appVersion = "1.1.1", appBuild = "111")
        val exit2 = TestData.getAnrExit(pid = 2)
        val session2 =
            getSession(sessionId = "session-2", pid = 2, appVersion = "1.1.2", appBuild = "112")

        anrExit.anrExits = listOf(exit1, exit2)
        sessionManager.appExitSessions[1] = session1
        sessionManager.appExitSessions[2] = session2

        // When
        anrExitCollector.collect()

        // Then
        verify(signalProcessor).trackForSession(
            any<ExceptionData>(),
            eq(exit1.timestampMs),
            eq(EventType.ANR),
            sessionId = eq(session1.id),
            sessionStartTime = eq(session1.createdAt),
            appVersion = eq(session1.appVersion),
            appBuild = eq(session1.appBuild),
            attachments = any(),
            threadName = any(),
            isSampled = any(),
        )
        verify(signalProcessor).trackForSession(
            any<ExceptionData>(),
            eq(exit2.timestampMs),
            eq(EventType.ANR),
            sessionId = eq(session2.id),
            sessionStartTime = eq(session2.createdAt),
            appVersion = eq(session2.appVersion),
            appBuild = eq(session2.appBuild),
            attachments = any(),
            threadName = any(),
            isSampled = any(),
        )
    }

    @Test
    fun `given no session is available for given pid, does not track an anr`() {
        // Given
        anrExit.anrExits = listOf(TestData.getAnrExit(pid = 1))

        // When
        anrExitCollector.collect()

        // Then
        verify(signalProcessor, never()).trackForSession<ExceptionData>(
            any(),
            any(),
            any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
            attachments = any(),
            threadName = any(),
            isSampled = any(),
        )
    }

    @Test
    fun `given no session is available for given pid, leaves the trace unread`() {
        anrExit.anrExits = listOf(TestData.getAnrExit(pid = 1))

        anrExitCollector.collect()

        assertTrue(anrExit.tracedPids.isEmpty())
    }

    @Test
    fun `clears the hold on anrs from processes that have since died`() {
        anrExit.anrExits = emptyList()

        anrExitCollector.collect()

        assertEquals(999, draftAnrStore.clearedForPid)
    }

    @Test
    fun `merges the thread dump into the held anr instead of tracking an app exit`() {
        // Given
        val heldAnr = DraftAnr("event-id-1", "2026-07-31T10:00:00.00000000Z", "path", 1)
        draftAnrStore.draftAnrs = listOf(heldAnr)
        anrExit.anrExits = listOf(
            TestData.getAnrExit(
                pid = 1,
                threadDump = "DALVIK THREADS (1):",
                subject = "Input dispatching timed out",
            ),
        )
        sessionManager.appExitSessions[1] = getSession(1)

        // When
        anrExitCollector.collect()

        // Then
        assertEquals(
            ThreadDumpMerge(heldAnr, "DALVIK THREADS (1):", "Input dispatching timed out"),
            draftAnrStore.merges.single(),
        )
        verify(signalProcessor, never()).trackForSession<ExceptionData>(
            any(),
            any(),
            any(),
            sessionId = any(),
            sessionStartTime = any(),
            appVersion = any(),
            appBuild = any(),
            attachments = any(),
            threadName = any(),
            isSampled = any(),
        )
    }

    @Test
    fun `merges into the latest anr held by a process when it held several`() {
        // Given
        val later = DraftAnr("later", "2026-07-31T10:05:00.00000000Z", "later-path", 1)
        draftAnrStore.draftAnrs = listOf(
            DraftAnr("earlier", "2026-07-31T10:00:00.00000000Z", "earlier-path", 1),
            later,
        )
        anrExit.anrExits = listOf(
            TestData.getAnrExit(
                pid = 1,
                threadDump = "DALVIK THREADS (1):",
            ),
        )

        // When
        anrExitCollector.collect()

        // Then
        assertEquals(later, draftAnrStore.merges.single().draftAnr)
    }

    @Test
    fun `does not merge when the exit carries no thread dump`() {
        draftAnrStore.draftAnrs = listOf(
            DraftAnr("event-id-1", "2026-07-31T10:00:00.00000000Z", "path", 1),
        )
        anrExit.anrExits = listOf(TestData.getAnrExit(pid = 1, threadDump = null))

        anrExitCollector.collect()

        assertTrue(draftAnrStore.merges.isEmpty())
    }

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
