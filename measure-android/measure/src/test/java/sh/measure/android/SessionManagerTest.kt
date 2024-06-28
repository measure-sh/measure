package sh.measure.android

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Database

class SessionManagerTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val logger = NoopLogger()
    private val database = mock<Database>()
    private val idProvider = FakeIdProvider()
    private val processInfo = FakeProcessInfoProvider()
    private val timeProvider = FakeTimeProvider()
    private val configProvider = FakeConfigProvider()

    private val sessionManager = SessionManagerImpl(
        logger = logger,
        database = database,
        idProvider = idProvider,
        processInfo = processInfo,
        ioExecutor = executorService,
        timeProvider = timeProvider,
        configProvider = configProvider,
    )

    @Test
    fun `given session ID does not exist, creates a new session ID and persists it to db`() {
        val expectedSessionId = "session-id"
        idProvider.id = expectedSessionId
        sessionManager.currentSessionId = null

        val sessionId = sessionManager.getSessionId()
        assertEquals(expectedSessionId, sessionId)
        verify(database).insertSession(expectedSessionId, processInfo.getPid(), timeProvider.fakeCurrentTimeSinceEpochInMillis)
    }

    @Test
    fun `given session ID already exists and app has been in background for less than threshold to end session, then returns existing session ID`() {
        val initialSessionId = "session-id-1"
        val updateSessionId = "session-id-2"
        sessionManager.currentSessionId = initialSessionId

        idProvider.id = updateSessionId
        simulateAppRelaunch(1000)

        val sessionId = sessionManager.getSessionId()
        assertEquals(initialSessionId, sessionId)
    }

    @Test
    fun `given session ID already exists and app has been in background for more than threshold to end session, then returns new session ID and persists to db`() {
        val initialSessionId = "session-id-1"
        val updatedSessionId = "session-id-2"
        sessionManager.currentSessionId = initialSessionId

        idProvider.id = updatedSessionId
        simulateAppRelaunch(configProvider.defaultSessionEndThresholdMs)

        val sessionId = sessionManager.getSessionId()
        assertEquals(updatedSessionId, sessionId)
        verify(database).insertSession(updatedSessionId, processInfo.getPid(), timeProvider.fakeCurrentTimeSinceEpochInMillis)
    }

    @Test
    fun `delegates to database to get sessions for pids where app exit has not been tracked`() {
        sessionManager.getSessionsForPids()
        verify(database).getSessionsWithUntrackedAppExit()
    }

    @Test
    fun `delegates to database to delete old sessions by calculating the time to clear up to`() {
        val currentTime = configProvider.defaultSessionsTableTtlMs + 1000
        timeProvider.fakeCurrentTimeSinceEpochInMillis = currentTime
        sessionManager.clearOldSessions()
        verify(database).clearOldSessions(currentTime - configProvider.defaultSessionsTableTtlMs)
    }

    private fun simulateAppRelaunch(durationMs: Long) {
        timeProvider.fakeUptimeMs = 1000
        sessionManager.onAppBackground()
        timeProvider.fakeUptimeMs = 1000 + durationMs
        sessionManager.onAppForeground()
    }
}
