package sh.measure.android.appexit

import android.app.ApplicationExitInfo
import androidx.concurrent.futures.ResolvableFuture
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeAppExitProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.storage.Database

class AppExitCollectorTest {
    private val logger = NoopLogger()
    private val appExitProvider = FakeAppExitProvider()
    private val database = mock<Database>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val signalProcessor = mock<SignalProcessor>()
    private val sessionManager = mock<SessionManager>()

    private val appExitCollector = AppExitCollector(
        logger,
        appExitProvider,
        executorService,
        database,
        signalProcessor,
        sessionManager,
    )

    @Test
    fun `given session is available for given pid, tracks app exit event`() {
        // Given
        val appExit = TestData.getAppExit()
        val pid = 1
        val pidToAppExit = pid to appExit
        val appExits = mapOf(pidToAppExit)
        appExitProvider.appExits = appExits
        val session = getSession(pid)
        `when`(database.getSessionForAppExit(pid)).thenReturn(session)

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).track(
            appExit,
            appExit.app_exit_time_ms,
            EventType.APP_EXIT,
            sessionId = session.id,
        )
    }

    @Test
    fun `given multiple sessions are available, tracks app exit event for each of them`() {
        // Given
        val appExit1 = TestData.getAppExit()
        val session1 = getSession(sessionId = "session-1", pid = 1)
        val appExit2 = TestData.getAppExit()
        val session2 = getSession(sessionId = "session-2", pid = 2)

        appExitProvider.appExits = mapOf(1 to appExit1, 2 to appExit2)
        `when`(database.getSessionForAppExit(1)).thenReturn(session1)
        `when`(database.getSessionForAppExit(2)).thenReturn(session2)

        // When
        appExitCollector.collect()

        // Then
        verify(signalProcessor).track(
            appExit1,
            appExit1.app_exit_time_ms,
            EventType.APP_EXIT,
            sessionId = session1.id,
        )
        verify(signalProcessor).track(
            appExit2,
            appExit2.app_exit_time_ms,
            EventType.APP_EXIT,
            sessionId = session2.id,
        )
    }

    @Test
    fun `marks session as crashed if app exit has crashed reason`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_CRASH)
        val session1 = getSession(sessionId = "session-1", pid = 1)

        appExitProvider.appExits = mapOf(1 to appExit1)
        `when`(database.getSessionForAppExit(1)).thenReturn(session1)

        // When
        appExitCollector.collect()

        // Then
        verify(sessionManager).markCrashedSession(session1.id)
    }

    @Test
    fun `marks session as crashed if app exit has ANR reason`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_ANR)
        val session1 = getSession(sessionId = "session-1", pid = 1)

        appExitProvider.appExits = mapOf(1 to appExit1)
        `when`(database.getSessionForAppExit(1)).thenReturn(session1)

        // When
        appExitCollector.collect()

        // Then
        verify(sessionManager).markCrashedSession(session1.id)
    }

    @Test
    fun `marks session as crashed if app exit has crash native reason`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_CRASH_NATIVE)
        val session1 = getSession(sessionId = "session-1", pid = 1)

        appExitProvider.appExits = mapOf(1 to appExit1)
        `when`(database.getSessionForAppExit(1)).thenReturn(session1)

        // When
        appExitCollector.collect()

        // Then
        verify(sessionManager).markCrashedSession(session1.id)
    }

    @Test
    fun `does not mark session as crashed if app exit has non-crashed reason`() {
        // Given
        val appExit1 = TestData.getAppExit(reasonId = ApplicationExitInfo.REASON_EXIT_SELF)
        val session1 = getSession(sessionId = "session-1", pid = 1)

        appExitProvider.appExits = mapOf(1 to appExit1)
        `when`(database.getSessionForAppExit(1)).thenReturn(session1)

        // When
        appExitCollector.collect()

        // Then
        verify(sessionManager, never()).markCrashedSession(any())
    }

    @Test
    fun `clears sessions that happened before the latest app exit`() {
        // Given
        val appExit1 = TestData.getAppExit()
        val session1 = getSession(sessionId = "session-1", pid = 1, createdAt = 1000)
        val appExit2 = TestData.getAppExit()
        val session2 = getSession(sessionId = "session-2", pid = 2, createdAt = 2000)

        appExitProvider.appExits = mapOf(1 to appExit1, 2 to appExit2)
        `when`(database.getSessionForAppExit(1)).thenReturn(session1)
        `when`(database.getSessionForAppExit(2)).thenReturn(session2)

        // When
        appExitCollector.collect()

        // Then
        verify(sessionManager).clearAppExitSessionsBefore(session2.createdAt)
    }

    @Test
    fun `tracks app exit only once`() {
        // Given
        val appExit = TestData.getAppExit()
        val pid = 1
        val pidToAppExit = pid to appExit
        val appExits = mapOf(pidToAppExit)
        appExitProvider.appExits = appExits
        val session = getSession(pid)
        `when`(database.getSessionForAppExit(pid)).thenReturn(session)

        // When
        appExitCollector.collect()
        appExitCollector.collect()

        // Then
        verify(signalProcessor, times(1)).track(
            appExit,
            appExit.app_exit_time_ms,
            EventType.APP_EXIT,
            sessionId = session.id,
        )
    }

    private fun getSession(pid: Int, sessionId: String = "session-id-1", createdAt: Long = 98765) =
        AppExitCollector.Session(id = sessionId, pid = pid, createdAt = createdAt)
}
