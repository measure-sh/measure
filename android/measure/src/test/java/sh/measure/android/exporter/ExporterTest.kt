package sh.measure.android.exporter

import android.database.Cursor
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
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
    )

    @Test
    fun `exports a batch with no attachments`() {
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
        val attachmentPacketsCaptor = argumentCaptor<List<AttachmentPacket>>()
        val spanPacketsCaptor = argumentCaptor<List<SpanPacket>>()
        verify(networkClient).execute(
            batchIdCaptor.capture(),
            eventPacketsCaptor.capture(),
            attachmentPacketsCaptor.capture(),
            spanPacketsCaptor.capture(),
        )
        Assert.assertEquals("batch1", batchIdCaptor.firstValue)
        Assert.assertEquals(2, eventPacketsCaptor.firstValue.size)
        Assert.assertEquals("event1", eventPacketsCaptor.firstValue[0].eventId)
        Assert.assertEquals("event2", eventPacketsCaptor.firstValue[1].eventId)
        Assert.assertEquals(0, attachmentPacketsCaptor.firstValue.size)
        Assert.assertEquals(0, spanPacketsCaptor.firstValue.size)
    }

    @Test
    fun `exports a batch with attachments`() {
        // seed the db with two events
        insertSessionInDb("sessionId")
        val attachment1 = AttachmentEntity("attachment1", "type", "name", "path")
        val attachment2 = AttachmentEntity("attachment2", "type", "name", "path")
        insertEventInDb(
            "sessionId",
            "event1",
            attachmentEntities = listOf(attachment1),
            attachmentSize = 100,
        )
        insertEventInDb(
            "sessionId",
            "event2",
            attachmentEntities = listOf(attachment2),
            attachmentSize = 100,
        )
        insertBatchInDb(
            Batch(
                "batchId",
                eventIds = listOf("event1", "event2"),
                spanIds = emptyList(),
            ),
        )

        exporter.export(
            Batch(
                "batchId",
                eventIds = listOf("event1", "event2"),
                spanIds = emptyList(),
            ),
        )

        val batchIdCaptor = argumentCaptor<String>()
        val eventPacketsCaptor = argumentCaptor<List<EventPacket>>()
        val attachmentPacketsCaptor = argumentCaptor<List<AttachmentPacket>>()
        val spanPacketsCaptor = argumentCaptor<List<SpanPacket>>()
        verify(networkClient).execute(
            batchIdCaptor.capture(),
            eventPacketsCaptor.capture(),
            attachmentPacketsCaptor.capture(),
            spanPacketsCaptor.capture(),
        )
        Assert.assertEquals("batchId", batchIdCaptor.firstValue)
        Assert.assertEquals(2, eventPacketsCaptor.firstValue.size)
        Assert.assertEquals("event1", eventPacketsCaptor.firstValue[0].eventId)
        Assert.assertEquals("event2", eventPacketsCaptor.firstValue[1].eventId)
        Assert.assertEquals(2, attachmentPacketsCaptor.firstValue.size)
        Assert.assertEquals("attachment1", attachmentPacketsCaptor.firstValue[0].id)
        Assert.assertEquals("attachment2", attachmentPacketsCaptor.firstValue[1].id)
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

        verify(networkClient, never()).execute(any(), any(), any(), any())
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
    fun `deletes the batch, events and attachments on successful export`() {
        `when`(networkClient.execute(any(), any(), any(), any())).thenReturn(HttpResponse.Success())
        val attachment1 = AttachmentEntity("attachment1", "type", "name", "path")
        val attachmentPath = getPathForAttachment(attachment1)
        insertSessionInDb("sessionId")
        insertEventInDb(
            "sessionId",
            "event1",
            attachmentEntities = listOf(attachment1),
            attachmentSize = 100,
        )
        insertEventInDb("sessionId", "event2")
        val eventIds = listOf("event1", "event2")
        insertBatchInDb(
            Batch("batch1", eventIds = eventIds, spanIds = emptyList()),
        )
        insertAttachmentToStorage(attachment1)
        // ensure batch, events, attachments are in storage
        val eventsBeforeExport = database.getEvents(eventIds)
        Assert.assertEquals(2, eventsBeforeExport.size)
        Assert.assertEquals(1, eventsBeforeExport[0].attachmentEntities?.size)
        Assert.assertNotNull(fileStorage.getFile(attachmentPath))
        Assert.assertEquals(1, database.getBatches(1).size)

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = emptyList()))

        // ensure batch, events, attachments are deleted from storage
        Assert.assertEquals(0, database.getEvents(eventIds).size)
        Assert.assertNull(fileStorage.getFile(attachmentPath))
        Assert.assertEquals(0, database.getBatches(1).size)
    }

    @Test
    fun `deletes the batch, events, spans and attachments on client error`() {
        `when`(
            networkClient.execute(
                any(),
                any(),
                any(),
                any(),
            ),
        ).thenReturn(HttpResponse.Error.ClientError(400))
        val attachment1 = AttachmentEntity("attachment1", "type", "name", "path")
        val attachmentPath = getPathForAttachment(attachment1)
        insertSessionInDb("sessionId")
        insertEventInDb(
            "sessionId",
            "event1",
            attachmentEntities = listOf(attachment1),
            attachmentSize = 100,
        )
        insertEventInDb("sessionId", "event2")
        insertSpanInDb("sessionId", "span1")
        val eventIds = listOf("event1", "event2")
        val spanIds = listOf("span1")
        insertBatchInDb(Batch("batch1", eventIds = eventIds, spanIds = spanIds))
        insertAttachmentToStorage(attachment1)

        // ensure batch, events, attachments are in storage
        val eventsBeforeExport = database.getEvents(eventIds)
        Assert.assertEquals(2, eventsBeforeExport.size)
        Assert.assertEquals(1, eventsBeforeExport[0].attachmentEntities?.size)
        Assert.assertNotNull(fileStorage.getFile(attachmentPath))
        Assert.assertEquals(1, database.getBatches(1).size)
        queryAllSpans().use {
            Assert.assertEquals(1, it.count)
        }

        exporter.export(Batch("batch1", eventIds = eventIds, spanIds = spanIds))

        // ensure batch, events, attachments are deleted from storage
        Assert.assertEquals(
            0,
            database.getEvents(eventIds).size,
        )
        Assert.assertNull(fileStorage.getFile(attachmentPath))
        Assert.assertEquals(0, database.getBatches(1).size)
        queryAllSpans().use {
            Assert.assertEquals(0, it.count)
        }
    }

    private fun queryAllSpans(): Cursor {
        return database.writableDatabase.query(
            SpansTable.TABLE_NAME,
            null,
            null,
            null,
            null,
            null,
            null,
        )
    }

    private fun getPathForAttachment(attachment1: AttachmentEntity) =
        "$rootDir/measure/${attachment1.id}"

    private fun insertAttachmentToStorage(attachment1: AttachmentEntity) {
        fileStorage.writeAttachment(attachment1.id, "content".toByteArray())
    }

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
                serializedAttachments = Json.encodeToString(attachmentEntities),
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
