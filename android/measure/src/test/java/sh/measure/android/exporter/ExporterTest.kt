@file:Suppress("SameParameterValue")

package sh.measure.android.exporter

import android.os.Build
import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import junit.framework.TestCase.assertEquals
import junit.framework.TestCase.assertTrue
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argThat
import org.mockito.kotlin.eq
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoMoreInteractions
import org.mockito.kotlin.whenever
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.BatchEntity
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.EventEntity
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.storage.SessionEntity
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.io.File

@RunWith(AndroidJUnit4::class)
internal class ExporterTest {
    private val logger = NoopLogger()
    private val attachmentExecutorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val eventExecutorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val idProvider = FakeIdProvider()
    private val context =
        InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
    private val database = DatabaseImpl(context, logger)
    private val rootDir = context.filesDir.path
    private val fileStorage = FileStorageImpl(rootDir, logger)
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider = FakeConfigProvider()
    private val networkClient = mock<NetworkClient>()
    private val httpClient = mock<HttpClient>()
    private val sleeper = FakeSleeper()

    private val exporter = ExporterImpl(
        fileStorage = fileStorage,
        networkClient = networkClient,
        database = database,
        logger = logger,
        timeProvider = timeProvider,
        configProvider = configProvider,
        idProvider = idProvider,
        httpClient = httpClient,
        sleeper = sleeper,
        attachmentExportService = attachmentExecutorService,
        eventExportService = eventExecutorService,
    )

    @Test
    fun `skips export when already in progress`() {
        exporter.isExporting.set(true)

        exporter.export()

        verify(networkClient, never()).execute(any(), any(), any())
    }

    @Test
    fun `exports existing batches in order`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        insertSessionInDb("session2")
        insertEventInDb("session2", "event2", sampled = true)
        insertBatchInDb("batch2", eventIds = setOf("event2"))

        exporter.export()

        val inOrder = inOrder(networkClient)

        inOrder.verify(networkClient).execute(
            eq("batch1"),
            any(),
            any(),
        )

        inOrder.verify(networkClient).execute(
            eq("batch2"),
            any(),
            any(),
        )
    }

    @Test
    fun `creates and exports new batches after existing batches`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        insertSessionInDb("session2")
        insertEventInDb("session2", "event2", sampled = true)

        exporter.export()

        val inOrder = inOrder(networkClient)

        inOrder.verify(networkClient).execute(
            eq("batch1"),
            any(),
            any(),
        )

        inOrder.verify(networkClient).execute(
            argThat { this != "batch1" },
            any(),
            any(),
        )
    }

    @Test
    fun `stops exporting new batches if existing batch export fails`() {
        whenever(networkClient.execute(any(), any(), any()))
            .thenReturn(HttpResponse.Error.ServerError(500))

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        insertSessionInDb("session2")
        insertEventInDb("session2", "event2", sampled = true)

        exporter.export()

        verify(networkClient).execute(
            eq("batch1"),
            any(),
            any(),
        )

        verifyNoMoreInteractions(networkClient)
    }

    @Test
    fun `exports batch with events and spans`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertSpanInDb("session1", "span1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"), spanIds = setOf("span1"))

        exporter.export()

        verify(networkClient).execute(
            eq("batch1"),
            argThat { size == 1 && first().eventId == "event1" },
            argThat { size == 1 && first().spanId == "span1" },
        )
    }

    @Test
    fun `deletes invalid batch with no events or spans`() {
        insertSessionInDb("session1")
        insertBatchInDb("batch1", eventIds = emptySet(), spanIds = emptySet())

        exporter.export()

        verify(networkClient, never()).execute(any(), any(), any())
        assertEquals(0, database.getBatchIds().size)
    }

    @Test
    fun `deletes invalid batch when no packets found in database`() {
        insertSessionInDb("session1")
        insertBatchInDb(
            "batch1",
            eventIds = setOf("nonexistent-event"),
            spanIds = setOf("nonexistent-span"),
        )

        exporter.export()

        verify(networkClient, never()).execute(any(), any(), any())
        assertEquals(0, database.getBatchIds().size)
    }

    @Test
    fun `sleeps between batch exports`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())
        configProvider.batchExportIntervalMs = 100L

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        insertSessionInDb("session2")
        insertEventInDb("session2", "event2", sampled = true)
        insertBatchInDb("batch2", eventIds = setOf("event2"))

        exporter.export()

        assertEquals(listOf(100L), sleeper.sleepCalls)
    }

    @Test
    fun `deletes batch on successful export`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        assertEquals(1, database.getBatchIds().size)

        exporter.export()

        assertEquals(0, database.getBatchIds().size)
        assertEquals(0, database.getEventPackets(listOf("event1")).size)
    }

    @Test
    fun `updates attachment URLs on successful export`() {
        val responseJson = attachmentResponseJson("attachment-1")
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(
                responseJson,
            ),
        )

        val attachmentFile = createTempAttachmentFile("attachment-1")
        insertSessionInDb("session1")
        insertEventInDb(
            sessionId = "session1",
            eventId = "event1",
            sampled = true,
            attachments = listOf(
                AttachmentEntity(
                    id = "attachment-1",
                    type = "screenshot",
                    path = attachmentFile.absolutePath,
                    name = "screenshot.png",
                ),
            ),
        )
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        val attachments = database.getAttachmentsToUpload(10)
        assertEquals(1, attachments.size)
        assertEquals("https://example.com/upload/attachment-1", attachments.first().url)
    }

    @Test
    fun `handles empty attachments list in response`() {
        val responseJson = """{"attachments": []}"""
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(
                responseJson,
            ),
        )

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        assertEquals(0, database.getBatchIds().size)
    }

    @Test
    fun `handles null response body gracefully`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success(null))

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        assertEquals(0, database.getBatchIds().size)
    }

    @Test
    fun `handles malformed response body gracefully`() {
        whenever(
            networkClient.execute(
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Success("invalid json"))

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        assertEquals(0, database.getBatchIds().size)
    }

    @Test
    fun `deletes batch on client error`() {
        whenever(
            networkClient.execute(
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Error.ClientError(400))

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        assertEquals(1, database.getBatchIds().size)

        exporter.export()

        assertEquals(0, database.getBatchIds().size)
        assertEquals(0, database.getEventPackets(listOf("event1")).size)
    }

    @Test
    fun `does not delete batch on server error`() {
        whenever(
            networkClient.execute(
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Error.ServerError(500))

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        assertEquals(1, database.getBatchIds().size)
        assertEquals(1, database.getEventPackets(listOf("event1")).size)
    }

    @Test
    fun `does not delete batch on unknown error`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Error.UnknownError(RuntimeException("network failure")),
        )

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        assertEquals(1, database.getBatchIds().size)
        assertEquals(1, database.getEventPackets(listOf("event1")).size)
    }

    @Test
    fun `includes events with valid serialized data file path`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())

        val dataFile = createTempDataFile("event2")
        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertEventInDb(
            sessionId = "session1",
            eventId = "event2",
            sampled = true,
            serializedDataFilePath = dataFile.absolutePath,
        )
        insertBatchInDb("batch1", eventIds = setOf("event1", "event2"))

        exporter.export()

        verify(networkClient).execute(
            eq("batch1"),
            argThat { size == 2 },
            any(),
        )
    }

    @Test
    fun `filters out events with invalid serialized data file path`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertEventInDb(
            sessionId = "session1",
            eventId = "event2",
            sampled = true,
            serializedDataFilePath = "/nonexistent/path/data.json",
        )
        insertBatchInDb("batch1", eventIds = setOf("event1", "event2"))

        exporter.export()

        verify(networkClient).execute(
            eq("batch1"),
            argThat { size == 1 && first().eventId == "event1" },
            any(),
        )
    }

    @Test
    fun `uploads attachments after events export`() {
        val responseJson = attachmentResponseJson("attachment-1")
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success(responseJson))
        whenever(httpClient.uploadFile(any(), any(), anyOrNull(), any(), any(), any())).thenReturn(HttpResponse.Success())

        val attachmentFile = createTempAttachmentFile("attachment-1")
        insertSessionInDb("session1")
        insertEventInDb(
            sessionId = "session1",
            eventId = "event1",
            sampled = true,
            attachments = listOf(
                AttachmentEntity(
                    id = "attachment-1",
                    type = "screenshot",
                    path = attachmentFile.absolutePath,
                    name = "screenshot.png",
                ),
            ),
        )
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        verify(httpClient).uploadFile(
            eq("https://example.com/upload/attachment-1"),
            any(),
            anyOrNull(),
            any(),
            any(),
            any(),
        )
    }

    @Test
    fun `deletes attachment file and DB entry on successful upload`() {
        val responseJson = attachmentResponseJson("attachment-1")
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(
                responseJson,
            ),
        )
        whenever(
            httpClient.uploadFile(
                any(),
                any(),
                anyOrNull(),
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Success())

        val attachmentFile = createTempAttachmentFile("attachment-1")
        insertSessionInDb("session1")
        insertEventInDb(
            sessionId = "session1",
            eventId = "event1",
            sampled = true,
            attachments = listOf(
                AttachmentEntity(
                    id = "attachment-1",
                    type = "screenshot",
                    path = attachmentFile.absolutePath,
                    name = "screenshot.png",
                ),
            ),
        )
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        assertEquals(0, database.getAttachmentsToUpload(10).size)
        assertFalse(attachmentFile.exists())
    }

    @Test
    fun `deletes attachment file and DB entry on client error`() {
        val responseJson = attachmentResponseJson("attachment-1")
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(responseJson),
        )
        whenever(
            httpClient.uploadFile(any(), any(), anyOrNull(), any(), any(), any()),
        ).thenReturn(HttpResponse.Error.ClientError(400))

        val attachmentFile = createTempAttachmentFile("attachment-1")
        insertSessionInDb("session1")
        insertEventInDb(
            sessionId = "session1",
            eventId = "event1",
            sampled = true,
            attachments = listOf(
                AttachmentEntity(
                    id = "attachment-1",
                    type = "screenshot",
                    path = attachmentFile.absolutePath,
                    name = "screenshot.png",
                ),
            ),
        )
        insertBatchInDb("batch1", eventIds = setOf("event1"))
        exporter.export()
        assertEquals(0, database.getAttachmentsToUpload(10).size)
        assertFalse(attachmentFile.exists())
    }

    @Test
    fun `does not delete attachment on server error`() {
        val responseJson = attachmentResponseJson("attachment-1")
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(
                responseJson,
            ),
        )
        whenever(
            httpClient.uploadFile(
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Error.ServerError(500))

        val attachmentFile = createTempAttachmentFile("attachment-1")
        insertSessionInDb("session1")
        insertEventInDb(
            sessionId = "session1",
            eventId = "event1",
            sampled = true,
            attachments = listOf(
                AttachmentEntity(
                    id = "attachment-1",
                    type = "screenshot",
                    path = attachmentFile.absolutePath,
                    name = "screenshot.png",
                ),
            ),
        )
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        assertEquals(1, database.getAttachmentsToUpload(10).size)
        assertTrue(attachmentFile.exists())
    }

    @Test
    fun `deletes unreadable attachment file and skips upload`() {
        val responseJson = attachmentResponseJson("attachment-1")
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(
                responseJson,
            ),
        )

        val nonExistentPath = "$rootDir/nonexistent-attachment.png"
        insertSessionInDb("session1")
        insertEventInDb(
            sessionId = "session1",
            eventId = "event1",
            sampled = true,
            attachments = listOf(
                AttachmentEntity(
                    id = "attachment-1",
                    type = "screenshot",
                    path = nonExistentPath,
                    name = "screenshot.png",
                ),
            ),
        )
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        verify(httpClient, never()).uploadFile(any(), any(), any(), any(), any(), any())
        assertEquals(0, database.getAttachmentsToUpload(10).size)
    }

    @Test
    fun `stops uploading when no attachments remain`() {
        whenever(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())

        insertSessionInDb("session1")
        insertEventInDb("session1", "event1", sampled = true)
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        verify(httpClient, never()).uploadFile(any(), any(), any(), any(), any(), any())
    }

    @Test
    fun `sleeps between attachment uploads`() {
        val responseJson = attachmentResponseJson("attachment-1", "attachment-2")
        whenever(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(
                responseJson,
            ),
        )
        whenever(
            httpClient.uploadFile(
                any(),
                any(),
                anyOrNull(),
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Success())
        configProvider.attachmentExportIntervalMs = 200L

        val attachmentFile1 = createTempAttachmentFile("attachment-1")
        val attachmentFile2 = createTempAttachmentFile("attachment-2")
        insertSessionInDb("session1")
        insertEventInDb(
            sessionId = "session1",
            eventId = "event1",
            sampled = true,
            attachments = listOf(
                AttachmentEntity(
                    id = "attachment-1",
                    type = "screenshot",
                    path = attachmentFile1.absolutePath,
                    name = "screenshot1.png",
                ),
                AttachmentEntity(
                    id = "attachment-2",
                    type = "screenshot",
                    path = attachmentFile2.absolutePath,
                    name = "screenshot2.png",
                ),
            ),
        )
        insertBatchInDb("batch1", eventIds = setOf("event1"))

        exporter.export()

        // Sleep happens between uploads (not after last one)
        assertEquals(listOf(200L), sleeper.sleepCalls)
    }

    private fun attachmentResponseJson(vararg ids: String): String {
        val attachments = ids.joinToString(",") { id ->
            """
        {
            "id": "$id",
            "type": "screenshot",
            "filename": "screenshot.png",
            "upload_url": "https://example.com/upload/$id",
            "expires_at": "2025-08-13T01:59:45.577889184Z",
            "headers": {}
        }
        """
        }
        return """{"attachments": [$attachments]}"""
    }

    private fun createTempAttachmentFile(name: String): File {
        val file = File(rootDir, "$name.png")
        file.parentFile?.mkdirs()
        file.writeBytes(byteArrayOf(1, 2, 3, 4))
        return file
    }

    private fun insertSessionInDb(sessionId: String, prioritySession: Boolean = false) {
        database.insertSession(
            SessionEntity(
                sessionId,
                pid = 12345,
                createdAt = 12345,
                prioritySession = prioritySession,
                supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
                appVersion = "1.0.0",
                appBuild = "100",
                trackJourney = false,
            ),
        )
    }

    private fun insertEventInDb(
        sessionId: String,
        eventId: String,
        sampled: Boolean = true,
        attachments: List<AttachmentEntity> = emptyList(),
        serializedDataFilePath: String? = null,
    ) {
        database.insertEvent(
            EventEntity(
                id = eventId,
                timestamp = "23456789",
                type = EventType.STRING,
                userTriggered = false,
                serializedData = if (serializedDataFilePath == null) "data" else null,
                filePath = serializedDataFilePath,
                sessionId = sessionId,
                attachmentEntities = attachments,
                attachmentsSize = attachments.sumOf { File(it.path).length() },
                serializedAttachments = if (attachments.isNotEmpty()) {
                    jsonSerializer.encodeToString(attachments)
                } else {
                    null
                },
                serializedAttributes = "attributes",
                serializedUserDefAttributes = null,
                isSampled = sampled,
            ),
        )
    }

    private fun insertBatchInDb(
        batchId: String,
        eventIds: Set<String> = emptySet(),
        spanIds: Set<String> = emptySet(),
    ) {
        database.insertBatch(
            BatchEntity(
                batchId = batchId,
                eventIds = eventIds,
                spanIds = spanIds,
                createdAt = 12345,
            ),
        )
    }

    private fun insertSpanInDb(sessionId: String, spanId: String, sampled: Boolean = true) {
        database.insertSpan(
            TestData.getSpanEntity(
                sessionId = sessionId,
                spanId = spanId,
                isSampled = sampled,
            ),
        )
    }

    private fun createTempDataFile(name: String): File {
        val file = File(rootDir, "$name-data.json")
        file.parentFile?.mkdirs()
        file.writeText("""{"key": "value"}""")
        return file
    }
}
