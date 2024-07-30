package sh.measure.android.appexit

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import sh.measure.android.SessionManager
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeAppExitProvider
import sh.measure.android.fakes.ImmediateExecutorService

class AppExitCollectorTest {
    private val appExitProvider = FakeAppExitProvider()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val eventProcessor = mock<EventProcessor>()
    private val sessionManager = mock<SessionManager>()

    private val appExitCollector = AppExitCollector(
        appExitProvider,
        executorService,
        eventProcessor,
        sessionManager,
    )

    @Before
    fun setUp() {
        `when`(sessionManager.getSessionId()).thenReturn("fake-session-id")
    }

    @Test
    fun `given no app exits available, does not track anything`() {
        appExitCollector.onColdLaunch()

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>(),
        )
    }

    @Test
    fun `given no sessions available, does not track anything`() {
        `when`(sessionManager.getSessionsForPids()).thenReturn(emptyMap())
        appExitCollector.onColdLaunch()

        val appExit = AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = 7654.toString(),
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE",
        )
        appExitProvider.appExits = mapOf(7654 to appExit)

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>(),
        )
    }

    @Test
    fun `given sessions are available, but no corresponding app exits, does not track anything`() {
        val sessionId = sessionManager.getSessionId()
        val pid = 7654
        appExitProvider.appExits = mapOf()
        `when`(sessionManager.getSessionsForPids()).thenReturn(mapOf(pid to listOf(sessionId)))

        appExitCollector.onColdLaunch()

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>(),
        )
    }

    @Test
    fun `given app exits are available, but sessions do not have the corresponding pids, does not track anything`() {
        val pid = 7654
        val appExit = AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = pid.toString(),
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE",
        )
        appExitProvider.appExits = mapOf(pid to appExit)
        `when`(sessionManager.getSessionsForPids()).thenReturn(mapOf(9999 to listOf("session-id")))

        appExitCollector.onColdLaunch()

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>(),
        )
    }

    @Test
    fun `given app exits are available and sessions have the corresponding pids, tracks the app exits`() {
        val sessionId = sessionManager.getSessionId()
        val pid = 7654
        val appExit = AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = pid.toString(),
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE",
            app_exit_time_ms = 1234567890,
        )
        appExitProvider.appExits = mapOf(pid to appExit)
        `when`(sessionManager.getSessionsForPids()).thenReturn(mapOf(pid to listOf(sessionId)))

        appExitCollector.onColdLaunch()

        verify(eventProcessor).track(
            data = appExit,
            timestamp = appExit.app_exit_time_ms,
            type = EventType.APP_EXIT,
            sessionId = sessionId,
        )
    }

    @Test
    fun `updates sessions table when app exit is tracked successfully`() {
        val sessionId = sessionManager.getSessionId()
        val pid = 7654
        val appExit = AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = pid.toString(),
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE",
        )
        appExitProvider.appExits = mapOf(pid to appExit)
        `when`(sessionManager.getSessionsForPids()).thenReturn(mapOf(pid to listOf(sessionId)))

        appExitCollector.onColdLaunch()

        verify(sessionManager).updateAppExitTracked(pid)
    }
}
