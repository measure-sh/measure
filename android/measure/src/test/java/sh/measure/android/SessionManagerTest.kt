package sh.measure.android

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakePackageInfoProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeRandomizer
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
import sh.measure.android.storage.Database
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.SessionEntity
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.IdProviderImpl
import sh.measure.android.utils.TestClock
import java.time.Duration

class SessionManagerTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val logger = NoopLogger()
    private val database = mock<Database>()
    private val prefsStorage = mock<PrefsStorage>()
    private val randomizer = FakeRandomizer()
    private val idProvider = IdProviderImpl(randomizer)
    private val processInfo = FakeProcessInfoProvider()
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val configProvider = FakeConfigProvider()
    private val packageInfoProvider = FakePackageInfoProvider()

    private val sessionManager = SessionManagerImpl(
        logger = logger,
        idProvider = idProvider,
        database = database,
        prefs = prefsStorage,
        processInfo = processInfo,
        timeProvider = timeProvider,
        configProvider = configProvider,
        ioExecutor = executorService,
        packageInfoProvider = packageInfoProvider,
        randomizer = randomizer,
    )

    @Before
    fun setup() {
        // forces "needs reporting" to be set to false
        configProvider.samplingRateForErrorFreeSessions = 0.0f
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
        `when`(prefsStorage.getRecentSession()).thenReturn(null)

        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        verify(database).insertSession(
            SessionEntity(
                sessionId,
                processInfo.getPid(),
                timeProvider.elapsedRealtime,
                needsReporting = false,
                crashed = false,
                supportsAppExit = false,
                appVersion = packageInfoProvider.appVersion,
                appBuild = packageInfoProvider.getVersionCode(),
            ),
        )
    }

    @Test
    fun `creates new session when last event occurred more than 3 minutes ago`() {
        // Given
        val initialTime = testClock.epochTime()

        val previousSession = RecentSession(
            id = "previous-session-id",
            lastEventTime = initialTime,
            createdAt = initialTime - Duration.ofMinutes(3).toMillis(),
            crashed = false,
            versionCode = packageInfoProvider.getVersionCode(),
        )
        `when`(prefsStorage.getRecentSession()).thenReturn(previousSession)

        // Advance time beyond the 3-minute session timeout
        testClock.advance(Duration.ofMinutes(4))

        // When
        sessionManager.init()
        val actualSessionId = sessionManager.getSessionId()

        // Then
        assertNotEquals(previousSession.id, actualSessionId)
    }

    @Test
    fun `continues previous session when last event occurred less than 3 minutes ago`() {
        // Given
        val initialTime = testClock.epochTime()

        val previousSession = RecentSession(
            id = "previous-session-id",
            lastEventTime = initialTime,
            createdAt = initialTime - Duration.ofMinutes(3).toMillis(),
            crashed = false,
            versionCode = packageInfoProvider.getVersionCode(),
        )
        `when`(prefsStorage.getRecentSession()).thenReturn(previousSession)

        // Advance time beyond the 3-minute session timeout
        testClock.advance(Duration.ofMinutes(1))

        // When
        sessionManager.init()
        val actualSessionId = sessionManager.getSessionId()

        // Then
        assertEquals(previousSession.id, actualSessionId)
    }

    @Test
    fun `creates new session if previous session happened more than 1 hour ago, even if last event happened within 3 minutes`() {
        // Given
        val previousSessionCreatedTime = testClock.epochTime()
        // Last event happened within 3 minutes of next session.
        val lastEventTime =
            previousSessionCreatedTime + Duration.ofHours(1).toMillis() - Duration.ofMinutes(3)
                .toMillis()
        val previousSession = RecentSession(
            id = "previous-session-id",
            lastEventTime = lastEventTime,
            createdAt = previousSessionCreatedTime,
            crashed = false,
            versionCode = packageInfoProvider.getVersionCode(),
        )
        `when`(prefsStorage.getRecentSession()).thenReturn(previousSession)

        // Advance time by 7 hours
        testClock.advance(Duration.ofHours(1))
        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        assertNotEquals(previousSession.id, sessionId)
    }

    @Test
    fun `creates new session if last session crashed, even if last event happened within 3 minutes`() {
        // Given
        val initialTime = testClock.epochTime()
        val previousSession = RecentSession(
            id = "previous-session-id",
            lastEventTime = initialTime,
            createdAt = initialTime - Duration.ofMinutes(3).toMillis(),
            crashed = true,
            versionCode = packageInfoProvider.getVersionCode(),
        )
        `when`(prefsStorage.getRecentSession()).thenReturn(previousSession)

        // Advance time by 10 minutes
        testClock.advance(Duration.ofMinutes(1))
        // When
        sessionManager.init()
        val sessionId = sessionManager.getSessionId()

        // Then
        assertNotEquals(previousSession.id, sessionId)
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
    fun `creates new session if elapsed time is zero due to device boot`() {
        // Given
        val initialTime = timeProvider.elapsedRealtime
        val previousSession = RecentSession(
            "previous-session-id",
            createdAt = initialTime - Duration.ofMinutes(3).toMillis(),
            lastEventTime = initialTime,
            versionCode = packageInfoProvider.getVersionCode(),
        )
        `when`(prefsStorage.getRecentSession()).thenReturn(previousSession)

        // Reset time to 0
        testClock.setTime(0)
        sessionManager.init()

        val actualSessionId = sessionManager.getSessionId()
        assertNotEquals(previousSession.id, actualSessionId)
    }

    @Test
    fun `creates new session if app version changed since last session`() {
        // Given
        val initialTime = timeProvider.elapsedRealtime
        val previousSession = RecentSession(
            "previous-session-id",
            createdAt = initialTime - Duration.ofMinutes(3).toMillis(),
            lastEventTime = initialTime,
            versionCode = "previous-version-code",
        )
        `when`(prefsStorage.getRecentSession()).thenReturn(previousSession)
        sessionManager.init()

        val actualSessionId = sessionManager.getSessionId()
        assertNotEquals(previousSession.id, actualSessionId)
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

    @Test
    fun `returns correct result on initialization`() {
        val initialTime = timeProvider.elapsedRealtime
        val r1 = sessionManager.init()

        // verify result
        assertEquals(SessionInitResult.NewSessionCreated(sessionManager.getSessionId()), r1)

        // setup recent session mock
        val session = RecentSession(
            id = "previous-session-id",
            lastEventTime = initialTime,
            createdAt = initialTime - Duration.ofMinutes(3).toMillis(),
            crashed = false,
            versionCode = packageInfoProvider.getVersionCode(),
        )
        `when`(prefsStorage.getRecentSession()).thenReturn(session)

        // verify result
        val r2 = sessionManager.init()
        assertEquals(SessionInitResult.SessionResumed(sessionManager.getSessionId()), r2)
    }
}
