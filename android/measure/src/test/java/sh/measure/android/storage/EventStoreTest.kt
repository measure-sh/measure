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
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.buildAttributes
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
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
        // given
        val exceptionData = TestData.getExceptionData()
        val event = exceptionData.toEvent(type = EventType.EXCEPTION)
        val argumentCaptor = argumentCaptor<EventEntity>()
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")

        // when
        eventStore.store(event)

        // then
        verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals("fake-file-path", eventEntity.filePath)
    }

    @Test
    fun `stores ANR event data in file storage and stores the path in database`() {
        // given
        val exceptionData = TestData.getExceptionData()
        val event = exceptionData.toEvent(type = EventType.ANR)
        val argumentCaptor = argumentCaptor<EventEntity>()
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")

        // when
        eventStore.store(event)

        // then
        verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals("fake-file-path", eventEntity.filePath)
    }

    @Test
    fun `given http event contains request body, stores it in file storage and stores the path in database`() {
        // given
        val httpData =
            TestData.getHttpData(requestBody = "request-body", responseBody = null)
        val event = httpData.toEvent(type = EventType.HTTP)
        val argumentCaptor = argumentCaptor<EventEntity>()
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")

        // when
        eventStore.store(event)

        // then
        verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals("fake-file-path", eventEntity.filePath)
    }

    @Test
    fun `given http event contains response body, stores it in file storage and stores the path in database`() {
        // given
        val httpData =
            TestData.getHttpData(requestBody = null, responseBody = "response-body")
        val event = httpData.toEvent(type = EventType.HTTP)
        val argumentCaptor = argumentCaptor<EventEntity>()
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")

        // when
        eventStore.store(event)

        // then
        verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals("fake-file-path", eventEntity.filePath)
    }

    @Test
    fun `given http event does not contain request or response body, stores it directly in database`() {
        val httpData = TestData.getHttpData(requestBody = null, responseBody = null)
        val event = httpData.toEvent(type = EventType.HTTP)
        val argumentCaptor = argumentCaptor<EventEntity>()
        eventStore.store(event)

        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNull(eventEntity.filePath)
        assertNotNull(eventEntity.serializedData)
    }

    @Test
    fun `given app_exit event contains a trace, stores the path in database`() {
        // given
        val appExit = TestData.getAppExit(trace = "trace")
        val event = appExit.toEvent(type = EventType.APP_EXIT)
        val argumentCaptor = argumentCaptor<EventEntity>()
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")

        // when
        eventStore.store(event)

        // then
        verify(fileStorage).writeEventData(
            event.id,
            event.serializeDataToString(),
        )
        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertEquals("fake-file-path", eventEntity.filePath)
    }

    @Test
    fun `given app_exit event does not contain a trace, stores the serialized data in database`() {
        val appExit = TestData.getAppExit(trace = null)
        val event = appExit.toEvent(type = EventType.APP_EXIT)
        val argumentCaptor = argumentCaptor<EventEntity>()
        eventStore.store(event)

        verify(database).insertEvent(argumentCaptor.capture())
        val eventEntity = argumentCaptor.firstValue
        assertNull(eventEntity.filePath)
        assertNotNull(eventEntity.serializedData)
    }

    @Test
    fun `given attachment contains byte array, writes attachment file and inserts event to db`() {
        val attachment = TestData.getAttachment(
            bytes = getAttachmentContent().toByteArray(),
            path = null,
        )
        val event = TestData.getClickData()
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
        val attachment = TestData.getAttachment(
            bytes = null,
            path = "fake-path",
        )
        val event = TestData.getClickData()
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
        val attachment = TestData.getAttachment(
            bytes = null,
            path = "fake-path",
            name = "name",
            type = "type",
        )
        val event = TestData.getClickData()
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
        val attachment = TestData.getAttachment(
            bytes = byteArrayOf(1, 2, 3),
            path = null,
            name = "name",
            type = "type",
        )
        `when`(fileStorage.writeAttachment(idProvider.id, attachment.bytes!!)).thenReturn("fake-path")
        val event = TestData.getClickData()
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
        val event = TestData.getClickData()
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
        val attachment = TestData.getAttachment(bytes = null, path = "fake-path")
        val event = TestData.getClickData()
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
        val event = TestData.getClickData().toEvent(
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
        val event = TestData.getClickData().toEvent(
            type = EventType.CLICK,
            id = idProvider.id,
            userDefinedAttributes = buildAttributes { put("key", "value") },
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
        val event = TestData.getClickData().toEvent(
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
        // given
        val exceptionData = TestData.getExceptionData()
        val event = exceptionData.toEvent(
            type = EventType.EXCEPTION,
            attachments = mutableListOf(
                TestData.getAttachment(bytes = null, path = "fake-path"),
                TestData.getAttachment(bytes = null, path = "fake-path"),
            ),
        )
        `when`(fileStorage.writeEventData(any(), any())).thenReturn("fake-file-path")
        `when`(database.insertEvent(any())).thenReturn(false)

        // when
        eventStore.store(event)

        // verify that the event and its attachments are deleted from file storage
        // attachment IDs are repeated because the event has two attachments
        verify(fileStorage).deleteEventIfExist(
            eventId = event.id,
            attachmentIds = listOf(idProvider.id, idProvider.id),
        )
    }

    @Test
    fun `given event data that needs to be stored in file, fails to store, then does not insert event in db`() {
        // given
        val exceptionData = TestData.getExceptionData()
        val event = exceptionData.toEvent(
            type = EventType.EXCEPTION,
            attachments = mutableListOf(
                TestData.getAttachment(bytes = null, path = "fake-path"),
                TestData.getAttachment(bytes = null, path = "fake-path"),
            ),
        )
        `when`(fileStorage.writeEventData(any(), any())).thenReturn(null)

        // when
        eventStore.store(event)

        // verify that the event is not inserted in the database
        verify(database, never()).insertEvent(any())
    }

    private fun getAttachmentContent(): String {
        return "lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    }
}
