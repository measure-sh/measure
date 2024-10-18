package sh.measure.android

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeRandomizer
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
import sh.measure.android.storage.Database
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.SessionEntity

class SessionManagerTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
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
        idProvider = idProvider,
        database = database,
        prefs = prefsStorage,
        processInfo = processInfo,
        timeProvider = timeProvider,
        configProvider = configProvider,
        ioExecutor = executorService,
    )

    @Before
    fun setup() {
        // forces "needs reporting" to be set to false
        configProvider.sessionSamplingRate = 0.0f
        randomizer.randomDouble = 0.0
    }

    @Test
    fun `throws if session is accessed before initialization`() {
        assertThrows(IllegalArgumentException::class.java) {
            sessionManager.getSessionId()
        }
    }

    @Test
    fun `creates new session when recent session is unavailable`() {
        // Given
        val expectedSessionId = "new-session-id"
        idProvider.id = expectedSessionId
        `when`(prefsStorage.getRecentSession()).thenReturn(null)

        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        assertEquals(expectedSessionId, sessionId)
        verify(database).insertSession(
            SessionEntity(
                expectedSessionId,
                processInfo.getPid(),
                timeProvider.elapsedRealtime,
                needsReporting = false,
                crashed = false,
                supportsAppExit = false,
            ),
        )
    }

    @Test
    fun `creates new session when last event happened after threshold time`() {
        // Given
        val expectedSessionId = "new-session-id"
        idProvider.id = expectedSessionId
        val lastEventTime = 1000L
        `when`(prefsStorage.getRecentSession()).thenReturn(
            RecentSession(
                id = "previous-session-id",
                lastEventTime = lastEventTime,
                createdAt = 9876544331,
                crashed = false,
            ),
        )
        timeProvider.fakeElapsedRealtime = lastEventTime + 5000
        configProvider.sessionEndThresholdMs = lastEventTime + 1000

        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        assertEquals(expectedSessionId, sessionId)
    }

    @Test
    fun `continues recent session when last event happened within threshold time`() {
        // Given
        idProvider.id = "new-session-id"
        val expectedSessionId = "previous-session-id"
        val lastEventTIme = 1000L
        `when`(prefsStorage.getRecentSession()).thenReturn(
            RecentSession(
                id = expectedSessionId,
                lastEventTime = lastEventTIme,
                createdAt = 9876544331,
                crashed = false,
            ),
        )
        timeProvider.fakeElapsedRealtime = lastEventTIme + 1000
        configProvider.sessionEndThresholdMs = lastEventTIme + 10000

        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        assertEquals(expectedSessionId, sessionId)
    }

    @Test
    fun `creates new session if last session crashed even if last event happened within threshold time`() {
        // Given
        configProvider.sessionEndThresholdMs = 100000L
        val sessionCreatedAt = 1000L
        timeProvider.fakeElapsedRealtime = sessionCreatedAt
        sessionManager.init()
        val initialSessionId = sessionManager.getSessionId()
        val newSessionId = "new-session-id"
        idProvider.id = newSessionId
        val unhandledExceptionEvent = TestData.getExceptionData()
            .toEvent(sessionId = initialSessionId, type = EventType.EXCEPTION)
        val lastEventTime = sessionCreatedAt + 1000
        timeProvider.fakeElapsedRealtime = lastEventTime
        sessionManager.onEventTracked(unhandledExceptionEvent)
        timeProvider.fakeElapsedRealtime = lastEventTime + 1000

        // When
        sessionManager.init()

        // Then
        assertEquals(newSessionId, sessionManager.getSessionId())
    }

    @Test
    fun `updates current session ID when new session is created`() {
        // Given
        val expectedSessionId = "new-session-id"
        idProvider.id = expectedSessionId
        `when`(prefsStorage.getRecentSession()).thenReturn(null)

        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        assertEquals(expectedSessionId, sessionId)
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
                createdAt = 9876544331,
                crashed = false,
            ),
        )
        timeProvider.fakeElapsedRealtime = lastEventTIme + 1000
        configProvider.sessionEndThresholdMs = lastEventTIme + 10000

        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        assertEquals(expectedSessionId, sessionId)
    }

    @Test
    fun `updates last event time in preferences when event is triggered`() {
        // Given
        sessionManager.init()
        val currentSessionId = sessionManager.getSessionId()

        // When
        sessionManager.onEventTracked(
            TestData.getScrollData().toEvent(type = EventType.SCROLL, sessionId = currentSessionId),
        )

        // Then
        Mockito.verify(prefsStorage, times(1))
            .setRecentSessionEventTime(timeProvider.elapsedRealtime)
    }

    @Test
    fun `sets crashed state for session in preferences when ANR event is triggered`() {
        // Given
        sessionManager.init()
        val currentSessionId = sessionManager.getSessionId()

        // When
        sessionManager.onEventTracked(
            TestData.getExceptionData().toEvent(type = EventType.ANR, sessionId = currentSessionId),
        )

        // Then
        Mockito.verify(prefsStorage, times(1)).setRecentSessionCrashed()
    }

    @Test
    fun `sets crashed state for session in preferences when unhandled exception event is triggered`() {
        // Given
        sessionManager.init()
        val currentSessionId = sessionManager.getSessionId()

        // When
        sessionManager.onEventTracked(
            TestData.getExceptionData(handled = false)
                .toEvent(type = EventType.EXCEPTION, sessionId = currentSessionId),
        )

        // Then
        Mockito.verify(prefsStorage, times(1)).setRecentSessionCrashed()
    }

    @Test
    fun `creates new session when app comes back to foreground after threshold time`() {
        // Given
        configProvider.sessionEndThresholdMs = 100L
        sessionManager.init()
        sessionManager.onAppForeground()

        val expectedSessionId = "new-session-id"
        idProvider.id = expectedSessionId

        // simulate app going to background
        val appBackgroundedAt = 1000L
        timeProvider.fakeElapsedRealtime = appBackgroundedAt
        sessionManager.onAppBackground()

        // increment time
        val timeInBackground = 1000L
        timeProvider.fakeElapsedRealtime = appBackgroundedAt + timeInBackground

        // When app comes back to foreground
        sessionManager.onAppForeground()
        assertEquals(expectedSessionId, sessionManager.getSessionId())
    }

    @Test
    fun `continues session when app comes back to foreground before threshold time`() {
        // Given
        val expectedSessionId = "initial-session-id"
        idProvider.id = expectedSessionId
        `when`(prefsStorage.getRecentSession()).thenReturn(RecentSession(expectedSessionId, 9876))
        `when`(database.insertSession(any())).thenReturn(true)

        configProvider.sessionEndThresholdMs = 10000L
        sessionManager.init()
        sessionManager.onAppForeground()

        val newSessionId = "new-session-id"
        idProvider.id = newSessionId

        // simulate app going to background
        val appBackgroundedAt = 1000L
        timeProvider.fakeElapsedRealtime = appBackgroundedAt
        sessionManager.onAppBackground()

        // increment time
        val timeInBackground = 1000L
        timeProvider.fakeElapsedRealtime = appBackgroundedAt + timeInBackground

        // When app comes back to foreground
        sessionManager.onAppForeground()
        assertEquals(expectedSessionId, sessionManager.getSessionId())
    }

    @Test
    fun `continues session when app comes to foreground for first time`() {
        // Given
        sessionManager.init()
        val initialSessionId = sessionManager.getSessionId()

        idProvider.id = "new-session-id"

        // When
        sessionManager.onAppForeground()

        assertEquals(initialSessionId, sessionManager.getSessionId())
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
