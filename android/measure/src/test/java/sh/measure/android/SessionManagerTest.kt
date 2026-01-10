package sh.measure.android

import android.os.Build
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.config.DefaultConfig
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakePackageInfoProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeSampler
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Database
import sh.measure.android.storage.SessionEntity
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.time.Duration

@RunWith(AndroidJUnit4::class)
class SessionManagerTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val logger = NoopLogger()
    private val database = mock<Database>()
    private val sampler = FakeSampler()
    private val idProvider = FakeIdProvider()
    private val processInfo = FakeProcessInfoProvider()
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val configProvider = FakeConfigProvider()
    private val packageInfoProvider = FakePackageInfoProvider()

    private val sessionManager = SessionManagerImpl(
        logger = logger,
        idProvider = idProvider,
        database = database,
        processInfo = processInfo,
        timeProvider = timeProvider,
        configProvider = configProvider,
        ioExecutor = executorService,
        packageInfoProvider = packageInfoProvider,
        sampler = sampler,
    )

    @Test
    fun `getSessionId throws when not initialized`() {
        assertThrows(IllegalArgumentException::class.java) {
            sessionManager.getSessionId()
        }
    }

    @Test
    fun `init creates and returns session id`() {
        val s1 = sessionManager.init()
        assertEquals(sessionManager.getSessionId(), s1)

        val s2 = sessionManager.init()
        assertEquals(sessionManager.getSessionId(), s2)
    }

    @Test
    fun `init stores session in database`() {
        val expectedSession = SessionEntity(
            sessionId = idProvider.uuid(),
            pid = processInfo.getPid(),
            createdAt = timeProvider.now(),
            prioritySession = false,
            crashed = false,
            supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
            trackJourney = false,
            appBuild = packageInfoProvider.getVersionCode(),
            appVersion = packageInfoProvider.appVersion,
        )
        sessionManager.init()

        verify(database).insertSession(expectedSession)
    }

    @Test
    fun `getSessionId returns same id after init`() {
        val sessionId = sessionManager.init()
        assertEquals(sessionId, sessionManager.getSessionId())
    }

    @Test
    fun `onAppForeground continues existing session for first time`() {
        sessionManager.init()
        sessionManager.onAppForeground()

        // session ID remains same
        assertEquals(sessionManager.getSessionId(), sessionManager.getSessionId())
    }

    @Test
    fun `onAppForeground creates new session when background time exceeds threshold`() {
        sessionManager.init()
        sessionManager.onAppBackground()

        testClock.advance(Duration.ofMillis(configProvider.sessionBackgroundTimeoutThresholdMs + 1))
        val updatedSessionId = "next-uuid"
        idProvider.id = updatedSessionId

        sessionManager.onAppForeground()

        // session ID changes
        assertEquals(updatedSessionId, sessionManager.getSessionId())
    }

    @Test
    fun `onAppForeground keeps same session when background time is under threshold`() {
        val initialSessionId = sessionManager.init()
        sessionManager.onAppBackground()

        testClock.advance(Duration.ofMillis(configProvider.sessionBackgroundTimeoutThresholdMs - 1))
        val nextSessionId = "next-uuid"
        idProvider.id = nextSessionId

        sessionManager.onAppForeground()

        // session ID remains same
        assertEquals(initialSessionId, sessionManager.getSessionId())
    }

    @Test
    fun `onAppForeground resets background time`() {
        sessionManager.init()
        // first app foreground is ignored
        sessionManager.onAppForeground()

        // initially background time is 0
        assertEquals(0L, sessionManager.appBackgroundTime)

        val initialTime = timeProvider.now()
        testClock.advance(Duration.ofMillis(100))
        sessionManager.onAppBackground()

        assertEquals(initialTime + 100, sessionManager.appBackgroundTime)

        // background time is reset
        sessionManager.onAppForeground()
        assertEquals(0L, sessionManager.appBackgroundTime)
    }

    @Test
    fun `onConfigLoaded marks journey events as sampled if enabled`() {
        sessionManager.init()
        configProvider.enableFullCollectionMode = false

        sampler.trackJourneyForSession = true

        sessionManager.onConfigLoaded()

        verify(database).sampleJourneyEvents(
            sessionManager.getSessionId(),
            DefaultConfig.JOURNEY_EVENTS,
        )
    }

    @Test
    fun `onConfigLoaded does not mark journey events as sampled if not enabled`() {
        sessionManager.init()
        configProvider.enableFullCollectionMode = false

        sampler.trackJourneyForSession = false

        sessionManager.onConfigLoaded()

        verify(database, never()).sampleJourneyEvents(any(), any())
    }
}
