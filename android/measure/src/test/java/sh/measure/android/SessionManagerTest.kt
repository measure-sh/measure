package sh.measure.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeRandomizer
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Database
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.SessionEntity

class SessionManagerTest {
    private val logger = NoopLogger()
    private val database = mock<Database>()
    private val prefsStorage = mock<PrefsStorage>()
    private val idProvider = FakeIdProvider()
    private val processInfo = FakeProcessInfoProvider()
    private val timeProvider = FakeTimeProvider()
    private val configProvider = FakeConfigProvider()
    private val randomizer = FakeRandomizer()

    private val sessionManager = SessionManagerImpl(
        logger = logger,
        database = database,
        prefs = prefsStorage,
        idProvider = idProvider,
        processInfo = processInfo,
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
    fun `current session is null by default`() {
        assertNull(sessionManager.currentSessionId)
    }

    @Test
    fun `creates new session when recent session is unavailable`() {
        // Given
        val expectedSessionId = "new-session-id"
        idProvider.id = expectedSessionId
        `when`(prefsStorage.getRecentSession()).thenReturn(null)

        // When
        val sessionId = sessionManager.getOrCreateSession()

        // Then
        assertEquals(expectedSessionId, sessionId)
        verify(database).insertSession(
            SessionEntity(
                expectedSessionId,
                processInfo.getPid(),
                timeProvider.currentTimeSinceEpochInMillis,
                needsReporting = false,
                crashed = false,
            )
        )
    }

    @Test
    fun `creates new session when last event of recent session happened after threshold time`() {
        // Given
        val expectedSessionId = "new-session-id"
        idProvider.id = expectedSessionId
        val lastEventTime = 1000L
        `when`(prefsStorage.getRecentSession()).thenReturn(
            RecentSession(
                id = "previous-session-id",
                lastEventTime = lastEventTime,
            ),
        )
        timeProvider.fakeCurrentTimeSinceEpochInMillis = lastEventTime + 5000
        configProvider.sessionEndThresholdMs = lastEventTime + 1000

        // When
        val sessionId = sessionManager.getOrCreateSession()

        // Then
        assertEquals(expectedSessionId, sessionId)
    }

    @Test
    fun `returns previous session id when last event of recent session happened within threshold time`() {
        // Given
        idProvider.id = "new-session-id"
        val expectedSessionId = "previous-session-id"
        val lastEventTIme = 1000L
        `when`(prefsStorage.getRecentSession()).thenReturn(
            RecentSession(
                id = expectedSessionId,
                lastEventTime = lastEventTIme,
            ),
        )
        timeProvider.fakeCurrentTimeSinceEpochInMillis = lastEventTIme + 1000
        configProvider.sessionEndThresholdMs = lastEventTIme + 10000

        // When
        val sessionId = sessionManager.getOrCreateSession()

        // Then
        assertEquals(expectedSessionId, sessionId)
    }

    @Test
    fun `updates current session ID when new session is created`() {
        // Given
        val expectedSessionId = "new-session-id"
        idProvider.id = expectedSessionId
        `when`(prefsStorage.getRecentSession()).thenReturn(null)

        // When
        sessionManager.getOrCreateSession()

        // Then
        assertEquals(expectedSessionId, sessionManager.currentSessionId)
    }

    @Test
    fun `updates current session ID when previous session is continued`() {
        // Given
        val expectedSessionId = "previous-session-id"
        idProvider.id = "new-session-id"
        val lastEventTIme = 1000L
        `when`(prefsStorage.getRecentSession()).thenReturn(
            RecentSession(
                id = expectedSessionId,
                lastEventTime = lastEventTIme,
            ),
        )
        timeProvider.fakeCurrentTimeSinceEpochInMillis = lastEventTIme + 1000
        configProvider.sessionEndThresholdMs = lastEventTIme + 10000

        // When
        sessionManager.getOrCreateSession()

        // Then
        assertEquals(expectedSessionId, sessionManager.currentSessionId)
    }

    @Test
    fun `uses cached recent session to get session id`() {
        // Given
        val currentSessionId = sessionManager.getOrCreateSession()
        sessionManager.onEventTracked()

        // When
        val sessionId = sessionManager.getOrCreateSession()

        // Then
        assertEquals(currentSessionId, sessionId)
        verify(prefsStorage, times(1)).getRecentSession()
    }

    @Test
    fun `updates preferences with recent session`() {
        // Given
        val currentSessionId = sessionManager.getOrCreateSession()
        val recentEvent = RecentSession(
            id = currentSessionId,
            lastEventTime = timeProvider.currentTimeSinceEpochInMillis,
        )

        // When
        sessionManager.onEventTracked()

        // Then
        Mockito.verify(prefsStorage, times(1)).setRecentSession(recentEvent)
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
}
