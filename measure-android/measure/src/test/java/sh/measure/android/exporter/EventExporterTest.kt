package sh.measure.android.exporter

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.EventEntity
import sh.measure.android.storage.FileStorageImpl

// This test uses robolectric and a real instance of batch creator to ensure that the batch creator
// and exporter work together correctly with a real database.
@RunWith(AndroidJUnit4::class)
internal class EventExporterTest {
    private val logger = NoopLogger()
    private val idProvider = FakeIdProvider()
    private val context =
        InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
    private val database = DatabaseImpl(context, logger)
    private val fileStorage = FileStorageImpl(context.filesDir.path, logger)
    private val timeProvider = FakeTimeProvider()
    private val configProvider = FakeConfigProvider()
    private val networkClient = mock<NetworkClient>()
    private val batchCreator = BatchCreatorImpl(
        logger,
        idProvider = idProvider,
        database = database,
        timeProvider = timeProvider,
        configProvider = configProvider,
    )
    private val eventExporter = EventExporterImpl(
        batchCreator = batchCreator,
        fileStorage = fileStorage,
        networkClient = networkClient,
        database = database,
        logger = logger,
    )

    @Test
    fun `exports a batch with no attachments`() {
        // seed the db with two events in 1 batch
        insertEventInDb("event1")
        insertEventInDb("event2")
        insertBatchInDb("batch1", listOf("event1", "event2"))

        eventExporter.export("batch1", listOf("event1", "event2"))

        val batchIdCaptor = argumentCaptor<String>()
        val eventPacketsCaptor = argumentCaptor<List<EventPacket>>()
        val attachmentPacketsCaptor = argumentCaptor<List<AttachmentPacket>>()
        verify(networkClient).execute(
            batchIdCaptor.capture(),
            eventPacketsCaptor.capture(),
            attachmentPacketsCaptor.capture(),
        )
        Assert.assertEquals("batch1", batchIdCaptor.firstValue)
        Assert.assertEquals(2, eventPacketsCaptor.firstValue.size)
        Assert.assertEquals("event1", eventPacketsCaptor.firstValue[0].eventId)
        Assert.assertEquals("event2", eventPacketsCaptor.firstValue[1].eventId)
        Assert.assertEquals(0, attachmentPacketsCaptor.firstValue.size)
    }

    @Test
    fun `exports a batch with attachments`() {
        // seed the db with two events
        val attachment1 = AttachmentEntity("attachment1", "type", "name", "path")
        val attachment2 = AttachmentEntity("attachment2", "type", "name", "path")
        insertEventInDb("event1", attachmentEntities = listOf(attachment1), attachmentSize = 100)
        insertEventInDb("event2", attachmentEntities = listOf(attachment2), attachmentSize = 100)
        insertBatchInDb("batchId", listOf("event1", "event2"))

        eventExporter.export("batchId", listOf("event1", "event2"))

        val batchIdCaptor = argumentCaptor<String>()
        val eventPacketsCaptor = argumentCaptor<List<EventPacket>>()
        val attachmentPacketsCaptor = argumentCaptor<List<AttachmentPacket>>()
        verify(networkClient).execute(
            batchIdCaptor.capture(),
            eventPacketsCaptor.capture(),
            attachmentPacketsCaptor.capture(),
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
        eventExporter.export("batch1", listOf("event-id"))

        verify(networkClient, never()).execute(any(), any(), any())
        Assert.assertEquals(0, eventExporter.batchIdsInTransit.size)
    }

    @Test
    fun `returns existing batches from the database`() {
        insertEventInDb("event1")
        insertEventInDb("event2")
        insertEventInDb("event3")
        insertEventInDb("event4")
        insertBatchInDb("batch1", listOf("event1", "event2"))
        insertBatchInDb("batch2", listOf("event3", "event4"))

        val batches = eventExporter.getExistingBatches()

        Assert.assertEquals(2, batches.size)
        Assert.assertEquals(listOf("event1", "event2"), batches["batch1"])
        Assert.assertEquals(listOf("event3", "event4"), batches["batch2"])
    }

    @Test
    fun `returns empty map if no batches exist in database`() {
        val batches = eventExporter.getExistingBatches()
        Assert.assertEquals(0, batches.size)
    }

    private fun insertEventInDb(
        eventId: String,
        attachmentEntities: List<AttachmentEntity> = emptyList(),
        attachmentSize: Long = 0,
    ) {
        database.insertEvent(
            EventEntity(
                id = eventId,
                timestamp = "23456789",
                type = "type",
                serializedData = "data",
                sessionId = "sessionId",
                attachmentEntities = attachmentEntities,
                attachmentsSize = attachmentSize,
                serializedAttachments = Json.encodeToString(attachmentEntities),
                serializedAttributes = "attributes",
            ),
        )
    }

    private fun insertBatchInDb(batchId: String, eventIds: List<String>) {
        database.insertBatch(eventIds, batchId, 12345L)
    }
}
