package sh.measure.android.appexit

import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeAppExit
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.TestData
import sh.measure.android.storage.SessionRecord

class AppExitCollectorTest {
    private val appExit = FakeAppExit()
    private val signalProcessor = mock<SignalProcessor>()
    private val sessionManager = FakeSessionManager()

    private val appExitCollector = AppExitCollector(
        appExit,
        signalProcessor,
        sessionManager,
    )

    @Test
    fun `given session is available for given pid, tracks app exit event`() {
        // Given
        val exit = TestData.getAppExit()
        val pid = 1
        appExit.appExits = mapOf(pid to exit)
        val session = getSession(pid)
        sessionManager.appExitSessions[pid] = session

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).trackForSession(
            eq(exit),
            eq(exit.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            sessionId = eq(session.id),
            sessionStartTime = eq(session.createdAt),
            appVersion = eq("1.0.0"),
            appBuild = eq("1000"),
            attachments = any(),
            threadName = any(),
            isSampled = any(),
        )
    }

    @Test
    fun `given multiple sessions are available, tracks app exit event for each of them`() {
        // Given
        val exit1 = TestData.getAppExit()
        val session1 =
            getSession(sessionId = "session-1", pid = 1, appVersion = "1.1.1", appBuild = "111")
        val exit2 = TestData.getAppExit()
        val session2 =
            getSession(sessionId = "session-2", pid = 2, appVersion = "1.1.2", appBuild = "112")

        appExit.appExits = mapOf(1 to exit1, 2 to exit2)
        sessionManager.appExitSessions[1] = session1
        sessionManager.appExitSessions[2] = session2

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).trackForSession(
            eq(exit1),
            eq(exit1.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            sessionId = eq(session1.id),
            sessionStartTime = eq(session1.createdAt),
            appVersion = eq(session1.appVersion),
            appBuild = eq(session1.appBuild),
            attachments = any(),
            threadName = any(),
            isSampled = any(),
        )
        verify(signalProcessor).trackForSession(
            eq(exit2),
            eq(exit2.app_exit_time_ms),
            eq(EventType.APP_EXIT),
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
    fun `given no session is available for given pid, does not track app exit event`() {
        // Given
        appExit.appExits = mapOf(1 to TestData.getAppExit())

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor, never()).trackForSession<AppExitData>(
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
