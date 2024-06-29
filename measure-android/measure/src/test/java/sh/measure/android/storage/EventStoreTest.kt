package sh.measure.android.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import java.io.File

internal class EventStoreTest {
    private val logger = NoopLogger()
    private val fileStorage = mock<FileStorage>()
    private val database = mock<Database>()
    private val idProvider = FakeIdProvider()

    private val eventStore: EventStore = EventStoreImpl(
        logger,
        fileStorage,
        database,
        idProvider,
    )

    @Test
    fun `stores exception event data in file storage and stores the path in database`() {
        val exceptionData = FakeEventFactory.getExceptionData()
        val event = exceptionData.toEvent(type = EventType.EXCEPTION)
        val argumentCaptor = argumentCaptor<EventEntity>()
        eventStore.store(event)

        val path: String? = verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals(path, eventEntity.filePath)
    }

    @Test
    fun `stores ANR event data in file storage and stores the path in database`() {
        val exceptionData = FakeEventFactory.getExceptionData()
        val event = exceptionData.toEvent(type = EventType.ANR)
        val argumentCaptor = argumentCaptor<EventEntity>()
        eventStore.store(event)

        val path: String? = verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals(path, eventEntity.filePath)
    }

    @Test
    fun `given http event contains request body, stores it in file storage and stores the path in database`() {
        val httpData =
            FakeEventFactory.getHttpData(requestBody = "request-body", responseBody = null)
        val event = httpData.toEvent(type = EventType.HTTP)
        val argumentCaptor = argumentCaptor<EventEntity>()
        eventStore.store(event)

        val path: String? = verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals(path, eventEntity.filePath)
    }

    @Test
    fun `given http event contains response body, stores it in file storage and stores the path in database`() {
        val httpData =
            FakeEventFactory.getHttpData(requestBody = null, responseBody = "response-body")
        val event = httpData.toEvent(type = EventType.HTTP)
        val argumentCaptor = argumentCaptor<EventEntity>()
        eventStore.store(event)

        val path: String? = verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals(path, eventEntity.filePath)
    }

    @Test
    fun `given http event does not contain request or response body, stores it directly in database`() {
        val httpData = FakeEventFactory.getHttpData(requestBody = null, responseBody = null)
        val event = httpData.toEvent(type = EventType.HTTP)
        val argumentCaptor = argumentCaptor<EventEntity>()
        eventStore.store(event)

        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNull(eventEntity.filePath)
        assertNotNull(eventEntity.serializedData)
    }

    @Test
    fun `given attachment contains byte array, writes attachment file and inserts event to db`() {
        val attachment = FakeEventFactory.getAttachment(
            bytes = getAttachmentContent().toByteArray(),
            path = null,
        )
        val event = FakeEventFactory.getClickData()
            .toEvent(type = EventType.CLICK, attachments = mutableListOf(attachment), id = idProvider.id)
        `when`(fileStorage.writeAttachment(event.id, attachment.bytes!!)).thenReturn("fake-path")

        eventStore.store(event)

        verify(fileStorage).writeAttachment(event.id, attachment.bytes)
        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals(1, eventEntity.attachmentEntities!!.size)
        assertEquals("fake-path", eventEntity.attachmentEntities.first().path)
    }

    @Test
    fun `given attachment contains path, inserts event to db`() {
        val attachment = FakeEventFactory.getAttachment(
            bytes = null,
            path = "fake-path",
        )
        val event = FakeEventFactory.getClickData()
            .toEvent(type = EventType.CLICK, attachments = mutableListOf(attachment), id = idProvider.id)

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals(1, eventEntity.attachmentEntities!!.size)
        assertEquals(attachment.path, eventEntity.attachmentEntities.first().path)
    }

    @Test
    fun `serializes attachment with path`() {
        val attachment = FakeEventFactory.getAttachment(
            bytes = null,
            path = "fake-path",
            name = "name",
            type = "type",
        )
        val event = FakeEventFactory.getClickData()
            .toEvent(type = EventType.CLICK, attachments = mutableListOf(attachment), id = idProvider.id)

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNotNull(eventEntity.serializedAttachments)
        assertEquals(
            "[{\"id\":\"${idProvider.id}\",\"type\":\"${attachment.type}\",\"name\":\"${attachment.name}\"}]",
            eventEntity.serializedAttachments,
        )
    }

    @Test
    fun `serializes attachment with bytes`() {
        val attachment = FakeEventFactory.getAttachment(
            bytes = byteArrayOf(1, 2, 3),
            path = null,
            name = "name",
            type = "type",
        )
        `when`(fileStorage.writeAttachment(idProvider.id, attachment.bytes!!)).thenReturn("fake-path")
        val event = FakeEventFactory.getClickData()
            .toEvent(type = EventType.CLICK, attachments = mutableListOf(attachment), id = idProvider.id)

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNotNull(eventEntity.serializedAttachments)
        assertEquals(
            "[{\"id\":\"${idProvider.id}\",\"type\":\"${attachment.type}\",\"name\":\"${attachment.name}\"}]",
            eventEntity.serializedAttachments,
        )
    }

    @Test
    fun `given no attachments, serialized attachments are set to null`() {
        val event = FakeEventFactory.getClickData()
            .toEvent(type = EventType.CLICK, attachments = mutableListOf(), id = idProvider.id)

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNull(eventEntity.serializedAttachments)
    }

    @Test
    fun `given attachments are present, calculates total size and stores it to db`() {
        val attachmentContent = getAttachmentContent()
        val attachment = FakeEventFactory.getAttachment(bytes = null, path = "fake-path")
        val event = FakeEventFactory.getClickData()
            .toEvent(type = EventType.CLICK, attachments = mutableListOf(attachment), id = idProvider.id)
        val file =
            File.createTempFile("fake-attachment", "txt").apply { writeText(attachmentContent) }
        `when`(fileStorage.getFile(attachment.path!!)).thenReturn(file)

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals(attachmentContent.length.toLong(), eventEntity.attachmentsSize)
    }

    @Test
    fun `serializes attributes and stores them to db`() {
        val event = FakeEventFactory.getClickData().toEvent(
            type = EventType.CLICK,
            id = idProvider.id,
            attributes = mutableMapOf("key" to "value"),
        )

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNotNull(eventEntity.serializedAttributes)
        assertEquals("{\"key\":\"value\"}", eventEntity.serializedAttributes)
    }

    @Test
    fun `serializes user defined attributes and stores them to db`() {
        val event = FakeEventFactory.getClickData().toEvent(
            type = EventType.CLICK,
            id = idProvider.id,
            userDefinedAttributes = mutableMapOf("key" to "value"),
        )

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNotNull(eventEntity.serializedUserDefAttributes)
        assertEquals("{\"key\":\"value\"}", eventEntity.serializedUserDefAttributes)
    }

    @Test
    fun `stores user triggered event to db`() {
        val event = FakeEventFactory.getClickData().toEvent(
            type = EventType.CLICK,
            id = idProvider.id,
            userTriggered = true,
        )

        eventStore.store(event)

        val argumentCaptor = argumentCaptor<EventEntity>()
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertTrue(eventEntity.userTriggered)
    }

    @Test
    fun `given event insertion in db fails, deletes event and attachment data from file storage`() {
        val exceptionData = FakeEventFactory.getExceptionData()
        val event = exceptionData.toEvent(
            type = EventType.EXCEPTION,
            attachments = mutableListOf(
                FakeEventFactory.getAttachment(bytes = null, path = "fake-path"),
                FakeEventFactory.getAttachment(bytes = null, path = "fake-path"),
            ),
        )
        `when`(database.insertEvent(any())).thenReturn(false)

        eventStore.store(event)

        // verify that the event and its attachments are deleted from file storage
        // attachment IDs are repeated because the event has two attachments
        verify(fileStorage).deleteEventIfExist(
            eventId = event.id,
            attachmentIds = listOf(idProvider.id, idProvider.id),
        )
    }

    private fun getAttachmentContent(): String {
        return "lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    }
}
