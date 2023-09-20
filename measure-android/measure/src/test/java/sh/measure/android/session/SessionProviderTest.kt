package sh.measure.android.session

import org.junit.Assert
import org.junit.Before
import org.junit.Test
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeResourceFactory
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger

class SessionProviderTest {
    private lateinit var sessionProvider: SessionProvider
    private val logger = NoopLogger()
    private val idProvider = FakeIdProvider()
    private val timeProvider = FakeTimeProvider()
    private val resourceFactory = FakeResourceFactory()

    @Before
    fun setup() {
        sessionProvider = SessionProvider(
            logger = logger,
            idProvider = idProvider,
            resourceFactory = resourceFactory,
            timeProvider = timeProvider,
        )
    }

    @Test
    fun `creates a session, caches it in memory and persists it to storage`() {
        val expectedSession = Session(
            idProvider.id, timeProvider.currentTimeSinceEpochInMillis, resourceFactory.resource
        )
        // When
        sessionProvider.createSession()

        // Then
        Assert.assertEquals(sessionProvider.session, expectedSession)
    }
}