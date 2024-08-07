package sh.measure.android

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeRandomizer
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Database
import sh.measure.android.storage.SessionEntity

class SessionManagerTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val logger = NoopLogger()
    private val database = mock<Database>()
    private val idProvider = FakeIdProvider()
    private val processInfo = FakeProcessInfoProvider()
    private val timeProvider = FakeTimeProvider()
    private val configProvider = FakeConfigProvider()
    private val randomizer = FakeRandomizer()

    private val sessionManager = SessionManagerImpl(
        logger = logger,
        database = database,
        idProvider = idProvider,
        processInfo = processInfo,
        ioExecutor = executorService,
        timeProvider = timeProvider,
        configProvider = configProvider,
    )

    @Before
    fun setup() {
        // forces "needs reporting" to be set to false
        configProvider.sessionSamplingRate = 0.0f
        randomizer.randomDouble = 0.0
    }

    @Test
    fun `init creates a new session and updates cached value, writes the session to db`() {
        // given
        val sessionId = "session-id"
        idProvider.id = sessionId

        // when
        sessionManager.init()

        // then
        assertNotNull(sessionManager.currentSessionId)
        verify(database).insertSession(
            SessionEntity(
                sessionId,
                processInfo.getPid(),
                timeProvider.fakeCurrentTimeSinceEpochInMillis,
                false,
            ),
        )
    }

    @Test
    fun `getSessionId throws exception if session ID does not exist`() {
        val expectedSessionId = "session-id"
        idProvider.id = expectedSessionId
        sessionManager.currentSessionId = null

        assertThrows(IllegalArgumentException::class.java) {
            sessionManager.getSessionId()
        }
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
        simulateAppRelaunch(configProvider.sessionEndThresholdMs)

        val sessionId = sessionManager.getSessionId()
        assertEquals(updatedSessionId, sessionId)
        verify(database).insertSession(
            SessionEntity(
                updatedSessionId,
                processInfo.getPid(),
                timeProvider.fakeCurrentTimeSinceEpochInMillis,
                false,
            ),
        )
    }

    @Test
    fun `delegates to database to get sessions for pids where app exit has not been tracked`() {
        sessionManager.getSessionsWithUntrackedAppExit()
        verify(database).getSessionsWithUntrackedAppExit()
    }

    @Test
    fun `delegates to database to mark a session as crashed`() {
        val sessionId = "session-id"
        sessionManager.markCrashedSession(sessionId)
        verify(database).markCrashedSession(sessionId)
    }

    @Test
    fun `delegates to database to mark a sessions as crashed`() {
        val sessionIds = listOf("session-id-1", "session-id-2")
        sessionManager.markCrashedSessions(sessionIds)
        verify(database).markCrashedSessions(sessionIds)
    }

    private fun simulateAppRelaunch(durationMs: Long) {
        timeProvider.fakeUptimeMs = 1000
        sessionManager.onAppBackground()
        timeProvider.fakeUptimeMs = 1000 + durationMs
        sessionManager.onAppForeground()
    }
}
