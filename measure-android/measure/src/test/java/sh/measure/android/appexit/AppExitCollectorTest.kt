package sh.measure.android.appexit

import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.kotlin.any
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeAppExitProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.DatabaseImpl

@RunWith(AndroidJUnit4::class)
class AppExitCollectorTest {
    private val appExitProvider = FakeAppExitProvider()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val eventProcessor = mock<EventProcessor>()
    private val timeProvider = FakeTimeProvider()
    private val database =
        DatabaseImpl(InstrumentationRegistry.getInstrumentation().context, NoopLogger())

    private val appExitCollector = AppExitCollector(
        appExitProvider, executorService, eventProcessor, timeProvider, database
    )

    @Test
    fun `given no app exits available, does not track anything`() {
        appExitCollector.onColdLaunch()

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>()
        )
    }

    @Test
    fun `given no untracked sessions available, does not track anything`() {
        appExitCollector.onColdLaunch()

        val appExit = AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = 7654,
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE"
        )
        appExitProvider.appExits = mapOf(7654 to appExit)

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>()
        )
    }

    @Test
    fun `given untracked sessions and app exits available, tracks and marks app exits as tracked`() {
        val sessionId = "session-1"
        val pid = 7654
        val appExit = AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = pid,
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE"
        )
        appExitProvider.appExits = mapOf(pid to appExit)
        database.insertSession(sessionId, pid, timeProvider.currentTimeSinceEpochInMillis)

        appExitCollector.onColdLaunch()

        verify(eventProcessor).track(
            appExit,
            timeProvider.currentTimeSinceEpochInMillis,
            EventType.APP_EXIT,
            sessionId = sessionId
        )

        val trackedSessions = database.getAppExitSessions()
        assertEquals(listOf(sessionId), trackedSessions)
    }

    @Test
    fun `given untracked sessions are available, but no corresponding app exits, does not track anything`() {
        val sessionId = "session-1"
        val pid = 7654
        appExitProvider.appExits = mapOf()
        database.insertSession(sessionId, pid, timeProvider.currentTimeSinceEpochInMillis)

        appExitCollector.onColdLaunch()

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>()
        )

        val trackedSessions = database.getAppExitSessions()
        assertEquals(emptyList<String>(), trackedSessions)
    }

    @Test
    fun `given app exits are available, but the untracked sessions do not have the corresponding pids, does not track anything`() {
        val pid = 7654
        val appExit = AppExit(
            reason = "REASON_USER_REQUESTED",
            pid = pid,
            trace = null,
            process_name = "com.example.app",
            importance = "IMPORTANCE_VISIBLE"
        )
        appExitProvider.appExits = mapOf(pid to appExit)

        appExitCollector.onColdLaunch()

        verify(eventProcessor, never()).track(
            data = any<AppExit>(),
            timestamp = any<Long>(),
            type = any<String>(),
            sessionId = any<String>()
        )
    }
}