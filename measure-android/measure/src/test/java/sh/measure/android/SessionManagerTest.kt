package sh.measure.android

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.atMostOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.SessionManagerImpl.Companion.MAX_SESSION_PERSISTENCE_TIME
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakePidProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.storage.Database

class SessionManagerTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val database = mock<Database>()
    private val idProvider = FakeIdProvider()
    private val pidProvider = FakePidProvider()
    private val timeProvider = FakeTimeProvider()

    private val sessionManager = SessionManagerImpl(
        database = database,
        idProvider = idProvider,
        pidProvider = pidProvider,
        executorService = executorService,
        timeProvider = timeProvider,
    )

    @Test
    fun `creates a new session ID and persists it to db, if it does not exist`() {
        pidProvider.id = 9776
        idProvider.id = "session-id"
        val result = sessionManager.sessionId

        verify(database).insertSession(
            idProvider.id,
            pidProvider.getPid(),
            timeProvider.currentTimeSinceEpochInMillis,
        )
        assertEquals(result, idProvider.id)
    }

    @Test
    fun `when new session is created, it also cleans older sessions if they exist`() {
        pidProvider.id = 9776
        idProvider.id = "session-id"
        sessionManager.sessionId

        verify(database, atMostOnce()).clearOldSessions(
            timeProvider.currentTimeSinceEpochInMillis - MAX_SESSION_PERSISTENCE_TIME)
    }

    @Test
    fun `returns existing session ID if it already exists`() {
        pidProvider.id = 9776
        idProvider.id = "session-id"
        sessionManager.sessionId

        // subsequent calls do not create new session
        val result = sessionManager.sessionId
        verify(database, atMostOnce()).insertSession(
            idProvider.id,
            pidProvider.getPid(),
            timeProvider.currentTimeSinceEpochInMillis,
        )
        assertEquals(result, idProvider.id)
    }
}
