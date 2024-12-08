package sh.measure.android.storage

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

class DataCleanupServiceTest {
    private val logger = NoopLogger()
    private val fileStorage = mock<FileStorage>()
    private val database = mock<Database>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val sessionManager = FakeSessionManager()
    private val configProvider = FakeConfigProvider()
    private val dataCleanupService = DataCleanupServiceImpl(
        logger,
        fileStorage,
        database,
        executorService,
        sessionManager,
        configProvider,
    )

    @Test
    fun `does not attempt deletion if no stale data is present and events in database are less than threshold`() {
        `when`(database.getSessionIds(any(), any(), any())).thenReturn(emptyList())
        `when`(database.getEventsCount()).thenReturn(1000)
        dataCleanupService.clearStaleData()

        verify(fileStorage, never()).deleteEventsIfExist(any(), any())
        verify(database, never()).deleteSessions(any())
    }

    @Test
    fun `given sessions that do not need reporting exist, deletes sessions and events from database and file storage`() {
        val sessionIds = listOf("session1", "session2")
        val eventIds = listOf("event1", "event2")
        val attachmentIds = listOf("attachment1", "attachment2")
        `when`(database.getSessionIds(any(), any(), eq(1))).thenReturn(sessionIds)
        `when`(database.getEventsForSessions(sessionIds)).thenReturn(eventIds)
        `when`(database.getAttachmentsForEvents(eventIds)).thenReturn(attachmentIds)
        `when`(database.deleteSessions(sessionIds)).thenReturn(true)

        // report lower number of events than threshold to avoid triggering deletion of oldest
        // session due to exceeding the max limit of events in db.
        `when`(database.getEventsCount()).thenReturn(100)

        dataCleanupService.clearStaleData()

        verify(fileStorage, times(1)).deleteEventsIfExist(eventIds, attachmentIds)
        verify(database, times(1)).deleteSessions(sessionIds)
    }

    @Test
    fun `given number of events in db exceed the max limit, deletes oldest session and events from database and file storage`() {
        `when`(database.getEventsCount()).thenReturn(configProvider.maxSignalsInDatabase + 1)
        `when`(database.getOldestSession()).thenReturn("session1")
        `when`(database.getEventsForSessions(listOf("session1"))).thenReturn(listOf("event1"))
        `when`(database.getAttachmentsForEvents(listOf("event1"))).thenReturn(listOf("attachment1"))
        `when`(database.deleteSessions(listOf("session1"))).thenReturn(true)

        // return empty list of session ids to avoid triggering deletion of sessions
        // not marked for reporting.
        `when`(database.getSessionIds(any(), any(), eq(1))).thenReturn(emptyList())

        dataCleanupService.clearStaleData()

        verify(fileStorage, times(1)).deleteEventsIfExist(listOf("event1"), listOf("attachment1"))
        verify(database, times(1)).deleteSessions(listOf("session1"))
    }
}
