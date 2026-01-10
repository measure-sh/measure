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
    fun `deleteEvents deletes events in batches and cleans up files`() {
        val firstBatchEventIds = (1..1000).map { "event$it" }
        val secondBatchEventIds = listOf("event1001", "event1002")

        setupDefaultMocks()
        `when`(database.deleteEvents(sessionManager.getSessionId(), 1000))
            .thenReturn(firstBatchEventIds)
            .thenReturn(secondBatchEventIds)

        dataCleanupService.cleanup()

        // Loop continues after first batch (size == 1000), breaks after second batch (size < 1000)
        verify(database, times(2)).deleteEvents(sessionManager.getSessionId(), 1000)
        verify(fileStorage, times(1)).deleteEventsIfExist(firstBatchEventIds)
        verify(fileStorage, times(1)).deleteAttachmentsIfExist(firstBatchEventIds)
        verify(fileStorage, times(1)).deleteEventsIfExist(secondBatchEventIds)
        verify(fileStorage, times(1)).deleteAttachmentsIfExist(secondBatchEventIds)
    }

    @Test
    fun `deleteEvents does not delete files when no events are deleted`() {
        setupDefaultMocks()
        `when`(database.deleteEvents(sessionManager.getSessionId(), 1000))
            .thenReturn(emptyList())

        dataCleanupService.cleanup()

        verify(fileStorage, never()).deleteEventsIfExist(any())
        verify(fileStorage, never()).deleteAttachmentsIfExist(any())
    }

    @Test
    fun `deleteSpans deletes spans in batches`() {
        val firstBatchSpanIds = (1..1000).map { "span$it" }
        val secondBatchSpanIds = listOf("span1001")

        setupDefaultMocks()
        `when`(database.deleteSpans(sessionManager.getSessionId(), 1000))
            .thenReturn(firstBatchSpanIds)
            .thenReturn(secondBatchSpanIds)

        dataCleanupService.cleanup()

        // Loop continues after first batch (size == 1000), breaks after second batch (size < 1000)
        verify(database, times(2)).deleteSpans(sessionManager.getSessionId(), 1000)
    }

    @Test
    fun `deleteEmptySessions deletes sessions with no events or spans`() {
        val sessionIds = listOf("session1", "session2", "session3")

        setupDefaultMocks()
        `when`(database.getSessionIds(sessionManager.getSessionId())).thenReturn(sessionIds)
        `when`(database.getEventsCount("session1")).thenReturn(0)
        `when`(database.getSpansCount("session1")).thenReturn(0)
        `when`(database.getEventsCount("session2")).thenReturn(5)
        `when`(database.getSpansCount("session2")).thenReturn(0)
        `when`(database.getEventsCount("session3")).thenReturn(0)
        `when`(database.getSpansCount("session3")).thenReturn(0)

        dataCleanupService.cleanup()

        verify(database, times(1)).deleteSession("session1")
        verify(database, never()).deleteSession("session2")
        verify(database, times(1)).deleteSession("session3")
    }

    @Test
    fun `deleteEmptySessions does not delete sessions with events`() {
        val sessionIds = listOf("session1")

        setupDefaultMocks()
        `when`(database.getSessionIds(sessionManager.getSessionId())).thenReturn(sessionIds)
        `when`(database.getEventsCount("session1")).thenReturn(10)
        `when`(database.getSpansCount("session1")).thenReturn(0)

        dataCleanupService.cleanup()

        verify(database, never()).deleteSession("session1")
    }

    @Test
    fun `deleteEmptySessions does not delete sessions with spans`() {
        val sessionIds = listOf("session1")

        setupDefaultMocks()
        `when`(database.getSessionIds(sessionManager.getSessionId())).thenReturn(sessionIds)
        `when`(database.getEventsCount("session1")).thenReturn(0)
        `when`(database.getSpansCount("session1")).thenReturn(5)

        dataCleanupService.cleanup()

        verify(database, never()).deleteSession("session1")
    }

    @Test
    fun `trimMemoryUsage deletes oldest session when disk usage exceeds limit`() {
        setupDefaultMocks()
        `when`(database.getEventsCount()).thenReturn(100)
        `when`(database.getSpansCount()).thenReturn(0)
        configProvider.estimatedEventSizeInKb = 1024
        configProvider.maxDiskUsageInMb = 50
        `when`(database.getOldestSession()).thenReturn("oldest-session")
        `when`(database.getEventsForSession("oldest-session")).thenReturn(listOf("event1", "event2"))
        `when`(database.getAttachmentsForEvents(listOf("event1", "event2"))).thenReturn(listOf("attachment1"))

        dataCleanupService.cleanup()

        verify(fileStorage, times(1)).deleteEventsIfExist(listOf("event1", "event2"))
        verify(fileStorage, times(1)).deleteAttachmentsIfExist(listOf("attachment1"))
        verify(database, times(1)).deleteSession("oldest-session")
    }

    @Test
    fun `trimMemoryUsage does not delete session when disk usage is within limit`() {
        // (100 * 15) / 1024 ≈ 1.5MB < 50MB limit
        setupDefaultMocks()
        `when`(database.getEventsCount()).thenReturn(100)
        `when`(database.getSpansCount()).thenReturn(0)

        dataCleanupService.cleanup()

        verify(database, never()).getOldestSession()
    }

    @Test
    fun `trimMemoryUsage does not delete current session even if it is oldest`() {
        setupDefaultMocks()
        `when`(database.getEventsCount()).thenReturn(3500)
        `when`(database.getSpansCount()).thenReturn(0)
        `when`(database.getOldestSession()).thenReturn(sessionManager.getSessionId())

        dataCleanupService.cleanup()

        verify(database, never()).deleteSession(sessionManager.getSessionId())
    }

    @Test
    fun `deleteBugReports cleans up old bug report directories while preserving current session`() {
        tempTestDir = createTempDirectory("bug-reports-test").toFile()
        val currentSessionDir = File(tempTestDir!!, sessionManager.getSessionId()).apply { mkdirs() }
        val oldSessionDir1 = File(tempTestDir!!, "old-session-1").apply { mkdirs() }
        val oldSessionDir2 = File(tempTestDir!!, "old-session-2").apply { mkdirs() }

        // Add some files to verify they get cleaned up
        File(currentSessionDir, "report.json").writeText("{}")
        File(oldSessionDir1, "report.json").writeText("{}")
        File(oldSessionDir2, "screenshot.png").writeBytes(byteArrayOf(1, 2, 3))

        setupDefaultMocks()
        // Override the default mock after setupDefaultMocks
        `when`(fileStorage.getBugReportDir()).thenReturn(tempTestDir)

        dataCleanupService.cleanup()

        assertTrue(currentSessionDir.exists())
        assertFalse(oldSessionDir1.exists())
        assertFalse(oldSessionDir2.exists())
    }

    @Test
    fun `deleteBugReports handles non-existent directory gracefully`() {
        setupDefaultMocks()
        val nonExistentDir = File("/non/existent/path")
        `when`(fileStorage.getBugReportDir()).thenReturn(nonExistentDir)

        // Should not throw
        dataCleanupService.cleanup()
    }

    @Test
    fun `deleteBugReports does not delete files in bug reports directory`() {
        tempTestDir = createTempDirectory("bug-reports-test").toFile()
        val fileInRoot = File(tempTestDir!!, "some-file.txt").apply { writeText("content") }

        setupDefaultMocks()
        `when`(fileStorage.getBugReportDir()).thenReturn(tempTestDir)

        dataCleanupService.cleanup()

        // Files (not directories) should not be deleted
        assertTrue(fileInRoot.exists())
    }

    private fun setupDefaultMocks() {
        // Default mocks for deleteEvents
        `when`(database.deleteEvents(any(), any()))
            .thenAnswer { invocation ->
                // Return empty if not already mocked
                emptyList<String>()
            }

        // Default mocks for deleteSpans
        `when`(database.deleteSpans(any(), any()))
            .thenAnswer { invocation ->
                emptyList<String>()
            }

        // Default mocks for deleteEmptySessions
        `when`(database.getSessionIds(any())).thenReturn(emptyList())

        // Default mocks for trimMemoryUsage
        `when`(database.getEventsCount()).thenReturn(100)
        `when`(database.getSpansCount()).thenReturn(0)

        // Default mocks for deleteBugReports
        val bugReportsDir = mock<File>()
        `when`(fileStorage.getBugReportDir()).thenReturn(bugReportsDir)
        `when`(bugReportsDir.exists()).thenReturn(false)
    }
}
