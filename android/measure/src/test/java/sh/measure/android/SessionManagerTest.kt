package sh.measure.android

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakePackageInfoProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeRandomizer
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.Database
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.IdProviderImpl
import sh.measure.android.utils.TestClock
import java.time.Duration

class SessionManagerTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val logger = NoopLogger()
    private val database = mock<Database>()
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
        processInfo = processInfo,
        timeProvider = timeProvider,
        configProvider = configProvider,
        ioExecutor = executorService,
        packageInfoProvider = packageInfoProvider,
        randomizer = randomizer,
    )

    @Before
    fun setup() {
        // forces "needs reporting" and "track journey events" to be set to false
        configProvider.samplingRateForErrorFreeSessions = 0.0f
        configProvider.journeySamplingRate = 0.0f
        randomizer.randomDouble = 0.0
    }

    @Test
    fun `throws if session is accessed before initialization`() {
        assertThrows(IllegalArgumentException::class.java) {
            sessionManager.getSessionId()
        }
    }

    @Test
    fun `returns a new session id on initialization`() {
        val s1 = sessionManager.init()
        assertEquals(sessionManager.getSessionId(), s1)

        val s2 = sessionManager.init()
        assertEquals(sessionManager.getSessionId(), s2)
    }

    @Test
    fun `starts new session when app comes back to foreground after threshold`() {
        configProvider.sessionBackgroundTimeoutThresholdMs = 1000
        val s1 = sessionManager.init()
        assertEquals(sessionManager.getSessionId(), s1)

        sessionManager.onAppBackground()
        testClock.advance(Duration.ofMillis(configProvider.sessionBackgroundTimeoutThresholdMs + 1))
        sessionManager.onAppForeground()

        assertNotEquals(sessionManager.getSessionId(), s1)
    }
}
