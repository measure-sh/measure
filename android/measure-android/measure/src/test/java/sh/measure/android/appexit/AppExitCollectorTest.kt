package sh.measure.android.appexit

import android.app.ApplicationExitInfo
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeAppExitProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.TestData
import sh.measure.android.storage.SessionRecord

class AppExitCollectorTest {
    private val appExitProvider = FakeAppExitProvider()
    private val signalProcessor = mock<SignalProcessor>()
    private val sessionManager = FakeSessionManager()

    private val appExitCollector = AppExitCollector(
        appExitProvider,
        signalProcessor,
        sessionManager,
    )

    @Test
    fun `given session is available for given pid, tracks app exit event`() {
        // Given
        val appExit = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val pid = 1
        val pidToAppExit = pid to appExit
        val appExits = mapOf(pidToAppExit)
        appExitProvider.appExits = appExits
        val session = getSession(pid)
        sessionManager.appExitSessions[pid] = session

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).trackAppExit(
            eq(appExit),
            eq(appExit.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            threadName = any(),
            sessionId = eq(session.id),
            sessionStartTime = eq(session.createdAt),
            appVersion = eq("1.0.0"),
            appBuild = eq("1000"),
            isSampled = any(),
        )
        assertEquals(
            session.id to appExit.app_exit_time_ms,
            sessionManager.markedAnrSessions.single(),
        )
    }

    @Test
    fun `given multiple sessions are available, tracks app exit event for each of them`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session1 =
            getSession(sessionId = "session-1", pid = 1, appVersion = "1.1.1", appBuild = "111")
        val appExit2 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session2 =
            getSession(sessionId = "session-2", pid = 2, appVersion = "1.1.2", appBuild = "112")

        appExitProvider.appExits = mapOf(1 to appExit1, 2 to appExit2)
        sessionManager.appExitSessions[1] = session1
        sessionManager.appExitSessions[2] = session2

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).trackAppExit(
            eq(appExit1),
            eq(appExit1.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            threadName = any(),
            sessionId = eq(session1.id),
            sessionStartTime = eq(session1.createdAt),
            appVersion = eq(session1.appVersion),
            appBuild = eq(session1.appBuild),
            isSampled = any(),
        )
        verify(signalProcessor).trackAppExit(
            eq(appExit2),
            eq(appExit2.app_exit_time_ms),
            eq(EventType.APP_EXIT),
            threadName = any(),
            sessionId = eq(session2.id),
            sessionStartTime = eq(session2.createdAt),
            appVersion = eq(session2.appVersion),
            appBuild = eq(session2.appBuild),
            isSampled = any(),
        )
    }

    @Test
    fun `given no session is available for given pid, does not track app exit event`() {
        // Given
        val appExit = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        appExitProvider.appExits = mapOf(1 to appExit)

        // When
        appExitCollector.collect()

        // Then
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
    fun `marks sessions as app exit tracked after collection`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session1 = getSession(sessionId = "session-1", pid = 1, createdAt = 1000)
        val appExit2 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session2 = getSession(sessionId = "session-2", pid = 2, createdAt = 2000)

        appExitProvider.appExits = mapOf(1 to appExit1, 2 to appExit2)
        sessionManager.appExitSessions[1] = session1
        sessionManager.appExitSessions[2] = session2

        // When
        appExitCollector.collect()

        // Then
        assertEquals(1, sessionManager.appExitTrackedCount)
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
