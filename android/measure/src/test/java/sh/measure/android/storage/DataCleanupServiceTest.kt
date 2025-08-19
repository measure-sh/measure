package sh.measure.android.storage

import androidx.concurrent.futures.ResolvableFuture
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
import java.io.File
import kotlin.io.path.createTempDirectory

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

    private var tempTestDir: File? = null

    @After
    fun tearDown() {
        tempTestDir?.deleteRecursively()
    }

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
        // Set up events+spans to exceed disk usage limit (50MB with 15KB per signal)
        // (3500 * 15) / 1024 ≈ 51.3MB > 50MB limit
        `when`(database.getEventsCount()).thenReturn(3500)
        `when`(database.getSpansCount()).thenReturn(0)
        `when`(database.getOldestSession()).thenReturn("session1")
        `when`(database.getEventsForSessions(listOf("session1"))).thenReturn(listOf("event1"))
        `when`(database.getAttachmentsForEvents(listOf("event1"))).thenReturn(listOf("attachment1"))
        `when`(database.deleteSessions(listOf("session1"))).thenReturn(true)

        // return empty list of session ids to avoid triggering deletion of sessions
        // not marked for reporting.
        `when`(database.getSessionIds(any(), any(), eq(1))).thenReturn(emptyList())

        // Mock getBugReportDir to handle deleteBugReports call
        val bugReportsDir = mock<File>()
        `when`(fileStorage.getBugReportDir()).thenReturn(bugReportsDir)
        `when`(bugReportsDir.exists()).thenReturn(false)

        dataCleanupService.clearStaleData()

        verify(fileStorage, times(1)).deleteEventsIfExist(listOf("event1"), listOf("attachment1"))
        verify(database, times(1)).deleteSessions(listOf("session1"))
    }

    @Test
    fun `cleans up old bug report directories while preserving current session`() {
        tempTestDir = createTempDirectory("bug-reports-test").toFile()
        val currentSessionDir = File(tempTestDir!!, "current-session").apply { mkdirs() }
        val oldSessionDir1 = File(tempTestDir!!, "old-session-1").apply { mkdirs() }
        val oldSessionDir2 = File(tempTestDir!!, "old-session-2").apply { mkdirs() }

        // Add some files to verify they get cleaned up
        File(oldSessionDir1, "report.json").writeText("{}")
        File(oldSessionDir2, "screenshot.png").writeBytes(byteArrayOf(1, 2, 3))

        sessionManager.session = "current-session"

        // Setup mocks to avoid triggering other cleanup operations
        `when`(database.getSessionIds(any(), any(), any())).thenReturn(emptyList())
        `when`(database.getEventsCount()).thenReturn(100)
        `when`(database.getSpansCount()).thenReturn(0)
        `when`(fileStorage.getBugReportDir()).thenReturn(tempTestDir)

        dataCleanupService.clearStaleData()

        // Verify actual filesystem behavior
        assertTrue(currentSessionDir.exists())
        assertFalse(oldSessionDir1.exists())
        assertFalse(oldSessionDir2.exists())
    }
}
