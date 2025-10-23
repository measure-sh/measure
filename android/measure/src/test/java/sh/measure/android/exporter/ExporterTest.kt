package sh.measure.android.exporter

import android.database.Cursor
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.encodeToString
import org.junit.Assert
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.BatchEntity
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.EventEntity
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.storage.SessionEntity
import sh.measure.android.storage.SpansTable
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

// This test uses robolectric and a real instance of batch creator to ensure that the batch creator
// and exporter work together correctly with a real database.
@RunWith(AndroidJUnit4::class)
internal class ExporterTest {
    private val logger = NoopLogger()
    private val idProvider = FakeIdProvider()
    private val context =
        InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
    private val database = DatabaseImpl(context, logger)
    private val rootDir = context.filesDir.path
    private val fileStorage = FileStorageImpl(rootDir, logger)
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider = FakeConfigProvider()
    private val networkClient = mock<NetworkClient>()
    private val attachmentExporter = mock<AttachmentExporter>()
    private val batchCreator = BatchCreatorImpl(
        logger,
        idProvider = idProvider,
        database = database,
        timeProvider = timeProvider,
        configProvider = configProvider,
    )
    private val exporter = ExporterImpl(
        batchCreator = batchCreator,
        fileStorage = fileStorage,
        networkClient = networkClient,
        database = database,
        logger = logger,
        attachmentExporter = attachmentExporter,
    )

    @Test
    fun `exports a batch`() {
        // seed the db with two events in 1 batch
        insertSessionInDb("session-id")
        insertEventInDb("session-id", "event1")
        insertEventInDb("session-id", "event2")
        insertBatchInDb(
            Batch(
                "batch1",
                eventIds = listOf("event1", "event2"),
                spanIds = emptyList(),
            ),
        )

        exporter.export(
            Batch(
                "batch1",
                eventIds = listOf("event1", "event2"),
                spanIds = emptyList(),
            ),
        )

        val batchIdCaptor = argumentCaptor<String>()
        val eventPacketsCaptor = argumentCaptor<List<EventPacket>>()
        val spanPacketsCaptor = argumentCaptor<List<SpanPacket>>()
        verify(networkClient).execute(
            batchIdCaptor.capture(),
            eventPacketsCaptor.capture(),
            spanPacketsCaptor.capture(),
        )
        Assert.assertEquals("batch1", batchIdCaptor.firstValue)
        Assert.assertEquals(2, eventPacketsCaptor.firstValue.size)
        Assert.assertEquals("event1", eventPacketsCaptor.firstValue[0].eventId)
        Assert.assertEquals("event2", eventPacketsCaptor.firstValue[1].eventId)
        Assert.assertEquals(0, spanPacketsCaptor.firstValue.size)
    }

    @Test
    fun `does not trigger export if no events are found in a batch`() {
        exporter.export(
            Batch(
                "batch1",
                eventIds = listOf("event-id"),
                spanIds = listOf("span-id"),
            ),
        )

        verify(networkClient, never()).execute(any(), any(), any())
        Assert.assertEquals(0, exporter.batchIdsInTransit.size)
    }

    @Test
    fun `returns existing batches from the database`() {
        insertSessionInDb("sessionId")
        insertEventInDb("sessionId", "event1")
        insertEventInDb("sessionId", "event2")
        insertEventInDb("sessionId", "event3")
        insertEventInDb("sessionId", "event4")
        insertBatchInDb(
            Batch(
                "batch1",
                eventIds = listOf("event1", "event2"),
                spanIds = emptyList(),
            ),
        )
        insertBatchInDb(
            Batch(
                "batch2",
                eventIds = listOf("event3", "event4"),
                spanIds = emptyList(),
            ),
        )

        val batches = exporter.getExistingBatches()

        Assert.assertEquals(2, batches.size)
        Assert.assertEquals(
            batches,
            listOf(
                Batch(
                    "batch1",
                    eventIds = listOf("event1", "event2"),
                    spanIds = emptyList(),
                ),
                Batch(
                    "batch2",
                    eventIds = listOf("event3", "event4"),
                    spanIds = emptyList(),
                ),
            ),
        )
    }

    @Test
    fun `returns empty map if no batches exist in database`() {
        val batches = exporter.getExistingBatches()
        Assert.assertEquals(0, batches.size)
    }

    @Test
    fun `deletes events in a batch on successful export`() {
        `when`(networkClient.execute(any(), any(), any())).thenReturn(HttpResponse.Success())
        insertSessionInDb("sessionId")
        insertEventInDb(
            "sessionId",
            "event1",
        )
        insertEventInDb("sessionId", "event2")
        val eventIds = listOf("event1", "event2")
        insertBatchInDb(
            Batch("batch1", eventIds = eventIds, spanIds = emptyList()),
        )
        // ensure events are in storage
        val eventsBeforeExport = database.getEvents(eventIds)
        Assert.assertEquals(2, eventsBeforeExport.size)
        Assert.assertEquals(1, database.getBatches(1).size)

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        // ensure events are deleted from storage
        Assert.assertEquals(0, database.getEvents(eventIds).size)
        Assert.assertEquals(0, database.getBatches(1).size)
    }

    @Test
    fun `deletes the batch, events and spans on client error`() {
        `when`(
            networkClient.execute(
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Error.ClientError(400))
        insertSessionInDb("sessionId")
        insertEventInDb("sessionId", "event1")
        insertEventInDb("sessionId", "event2")
        insertSpanInDb("sessionId", "span1")
        val eventIds = listOf("event1", "event2")
        val spanIds = listOf("span1")
        insertBatchInDb(Batch("batch1", eventIds = eventIds, spanIds = spanIds))

        // ensure batch, events are in storage
        val eventsBeforeExport = database.getEvents(eventIds)
        Assert.assertEquals(2, eventsBeforeExport.size)
        Assert.assertEquals(1, database.getBatches(1).size)
        queryAllSpans().use {
            Assert.assertEquals(1, it.count)
        }

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = spanIds))

        // ensure batch, events are deleted from storage
        Assert.assertEquals(
            0,
            database.getEvents(eventIds).size,
        )
        Assert.assertEquals(0, database.getBatches(1).size)
        queryAllSpans().use {
            Assert.assertEquals(0, it.count)
        }
    }

    @Test
    fun `updates attachment table with signed URLs from events response on successful export`() {
        val attachment1 = AttachmentEntity(
            id = "attachment-1",
            type = "screenshot",
            path = "path/to/attachment1",
            name = "screenshot.png",
        )
        val attachment2 = AttachmentEntity(
            id = "attachment-2",
            type = "layout_snapshot",
            path = "path/to/attachment2",
            name = "layout.json",
        )
        val eventsResponseJson = """
            {
                "attachments": [
                    {
                        "id": "attachment-1",
                        "type": "screenshot",
                        "filename": "screenshot.png",
                        "upload_url": "https://example.com/upload/attachment-1?signed=true",
                        "expires_at": "2025-08-13T01:59:45.577889184Z",
                        "headers": {
                            "key": "value"
                        }
                    },
                    {
                        "id": "attachment-2",
                        "type": "layout_snapshot",
                        "filename": "layout.json",
                        "upload_url": "https://example.com/upload/attachment-2?signed=true",
                        "expires_at": "2025-08-13T01:59:45.577889184Z",
                        "headers": {
                            "key": "value"
                        }
                    }
                ]
            }
        """.trimIndent()
        `when`(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(eventsResponseJson),
        )

        insertSessionInDb("sessionId")
        insertEventInDb(
            "sessionId",
            "event1",
            attachmentEntities = listOf(attachment1, attachment2),
            attachmentSize = 1000,
        )
        val eventIds = listOf("event1")
        insertBatchInDb(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        // Verify attachment URLs were updated in database
        val attachmentPackets = database.getAttachmentsToUpload(maxCount = 100, emptyList())
        Assert.assertEquals(2, attachmentPackets.size)
    }

    @Test
    fun `handles empty attachments list in events response`() {
        val eventsResponseJson = """
            {
                "attachments": []
            }
        """.trimIndent()
        `when`(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(eventsResponseJson),
        )

        insertSessionInDb("sessionId")
        insertEventInDb("sessionId", "event1")
        val eventIds = listOf("event1")
        insertBatchInDb(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        // Should complete successfully without errors
        Assert.assertEquals(0, database.getEvents(eventIds).size)
    }

    @Test
    fun `handles null response body gracefully`() {
        `when`(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success(null),
        )

        insertSessionInDb("sessionId")
        insertEventInDb("sessionId", "event1")
        val eventIds = listOf("event1")
        insertBatchInDb(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        // Should complete successfully without errors
        Assert.assertEquals(0, database.getEvents(eventIds).size)
    }

    @Test
    fun `handles malformed events response body`() {
        `when`(networkClient.execute(any(), any(), any())).thenReturn(
            HttpResponse.Success("invalid json"),
        )

        insertSessionInDb("sessionId")
        insertEventInDb("sessionId", "event1")
        val eventIds = listOf("event1")
        insertBatchInDb(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        // Should complete successfully without errors, events should still be deleted
        Assert.assertEquals(0, database.getEvents(eventIds).size)
    }

    private fun queryAllSpans(): Cursor = database.writableDatabase.query(
        SpansTable.TABLE_NAME,
        null,
        null,
        null,
        null,
        null,
        null,
    )

    private fun insertEventInDb(
        sessionId: String,
        eventId: String,
        attachmentEntities: List<AttachmentEntity> = emptyList(),
        attachmentSize: Long = 0,
    ) {
        database.insertEvent(
            EventEntity(
                id = eventId,
                timestamp = "23456789",
                type = EventType.STRING,
                userTriggered = false,
                serializedData = "data",
                sessionId = sessionId,
                attachmentEntities = attachmentEntities,
                attachmentsSize = attachmentSize,
                serializedAttachments = jsonSerializer.encodeToString(attachmentEntities),
                serializedAttributes = "attributes",
                serializedUserDefAttributes = null,
            ),
        )
    }

    private fun insertBatchInDb(batch: Batch) {
        database.insertBatch(
            BatchEntity(
                batchId = batch.batchId,
                eventIds = batch.eventIds,
                spanIds = batch.spanIds,
                createdAt = 12345,
            ),
        )
    }

    private fun insertSessionInDb(sessionId: String) {
        database.insertSession(
            SessionEntity(
                sessionId,
                12345,
                12345,
                needsReporting = false,
                supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
                appVersion = "1.0.0",
                appBuild = "100",
            ),
        )
    }

    private fun insertSpanInDb(sessionId: String, spanId: String) {
        database.insertSpan(TestData.getSpanEntity(sessionId = sessionId, spanId = spanId))
    }
}
