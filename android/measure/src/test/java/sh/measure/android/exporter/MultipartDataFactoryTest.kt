package sh.measure.android.exporter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.kotlin.mock
import sh.measure.android.exporter.MultipartDataFactoryImpl.Companion.ATTACHMENT_NAME_PREFIX
import sh.measure.android.exporter.MultipartDataFactoryImpl.Companion.EVENT_FORM_NAME
import sh.measure.android.exporter.MultipartDataFactoryImpl.Companion.SPAN_FORM_NAME
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage
import sh.measure.android.utils.iso8601Timestamp
import java.io.File
import java.io.InputStream

class MultipartDataFactoryTest {
    private val logger: Logger = NoopLogger()
    private val fileStorage: FileStorage = mock()
    private val multipartDataFactory: MultipartDataFactoryImpl =
        MultipartDataFactoryImpl(logger, fileStorage)
    private val fakeFile =
        File.createTempFile("file", "txt").apply { writeText(getFakeFileContent()) }

    @Test
    fun `createFromEventPacket with serializedData returns FormField`() {
        fun EventPacket.expectedSerializedValue(): String {
            return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"${type.value}\",\"${type.value}\":$serializedData,\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes,\"user_defined_attribute\":$serializedUserDefinedAttributes}"
        }

        // Given
        val eventEntity =
            TestData.getEventEntity(eventId = "event-id", serializedData = "serialized-data")
        val eventPacket = TestData.getEventPacket(eventEntity)

        // When
        val result = multipartDataFactory.createFromEventPacket(eventPacket)

        // Then
        assert(result is MultipartData.FormField)
        val formField = result as MultipartData.FormField
        assertEquals(EVENT_FORM_NAME, formField.name)
        assertEquals(eventPacket.expectedSerializedValue(), formField.value)
    }

    @Test
    fun `createFromEventPacket with filePath returns FormField`() {
        fun EventPacket.expectedSerializedValue(): String {
            return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"${type.value}\",\"${type.value}\":${getFakeFileContent()},\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes,\"user_defined_attribute\":$serializedUserDefinedAttributes}"
        }

        val eventEntity = TestData.getEventEntity(
            eventId = "event-id",
            filePath = "/path/to/file.json",
            serializedData = null,
        )
        val eventPacket = TestData.getEventPacket(eventEntity)

        `when`(fileStorage.getFile("/path/to/file.json")).thenReturn(fakeFile)

        val result: MultipartData? = multipartDataFactory.createFromEventPacket(eventPacket)

        assert(result is MultipartData.FormField)
        val formField = result as MultipartData.FormField
        assertEquals(EVENT_FORM_NAME, formField.name)
        assertEquals(eventPacket.expectedSerializedValue(), formField.value)
    }

    @Test
    fun `createFromEventPacket with filePath returns null when file not found`() {
        val eventEntity = TestData.getEventEntity(
            eventId = "event-id",
            filePath = "/path/to/nonexistent.json",
            serializedData = null,
        )
        val eventPacket = TestData.getEventPacket(eventEntity)

        `when`(fileStorage.getFile("/path/to/nonexistent.json")).thenReturn(null)

        val result = multipartDataFactory.createFromEventPacket(eventPacket)

        assertNull(result)
    }

    @Test
    fun `createFromAttachmentPacket returns FileData when file exists`() {
        val attachmentPacket = TestData.getAttachmentPacket(
            id = "attachment-id",
            filePath = "/path/to/attachment.png",
        )
        `when`(fileStorage.getFile(attachmentPacket.filePath)).thenReturn(fakeFile)

        val result = multipartDataFactory.createFromAttachmentPacket(attachmentPacket)

        assert(result is MultipartData.FileData)
        assertEquals(
            "${ATTACHMENT_NAME_PREFIX}attachment-id",
            (result as MultipartData.FileData).name,
        )
        assertEquals("${ATTACHMENT_NAME_PREFIX}attachment-id", result.filename)
        assertEquals(getFakeFileContent(), result.inputStream.readAsString())
    }

    @Test
    fun `createFromAttachmentPacket returns null when file not found`() {
        val attachmentPacket = TestData.getAttachmentPacket(
            id = "attachment-id",
            filePath = "/path/to/invalid_path",
        )
        `when`(fileStorage.getFile(attachmentPacket.filePath)).thenReturn(null)

        val result = multipartDataFactory.createFromAttachmentPacket(attachmentPacket)

        assertNull(result)
    }

    @Test
    fun `createFromSpanPacket returns FormField`() {
        val startTime: Long = 1000
        val endTime: Long = 5000
        val checkpoint = TestData.getCheckpoint()
        fun expectedSerializedValue(): String {
            return "{\"name\":\"span-name\",\"trace_id\":\"trace-id\",\"span_id\":\"span-id\",\"parent_id\":\"parent-id\",\"session_id\":\"session-id\",\"start_time\":\"${startTime.iso8601Timestamp()}\",\"end_time\":\"${endTime.iso8601Timestamp()}\",\"duration\":4000,\"status\":1,\"attributes\":{\"key\":\"value\"},\"user_defined_attribute\":{\"user_key\":\"user_value\"},\"checkpoints\":[{\"name\":\"${checkpoint.name}\",\"timestamp\":\"${checkpoint.timestamp.iso8601Timestamp()}\"}]}"
        }

        // Given
        val attributes = mapOf("key" to "value")
        val userDefinedAttrs = mapOf("user_key" to "user_value")
        val spanEntity = TestData.getSpanEntity(
            spanId = "span-id",
            checkpoints = mutableListOf(checkpoint),
            startTime = startTime,
            endTime = endTime,
            duration = endTime - startTime,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
        )
        val spanPacket = TestData.getSpanPacket(spanEntity)

        // When
        val result = multipartDataFactory.createFromSpanPacket(spanPacket)

        // Then
        assert(result is MultipartData.FormField)
        val formField = result as MultipartData.FormField
        assertEquals(SPAN_FORM_NAME, formField.name)
        assertEquals(expectedSerializedValue(), formField.value)
    }

    @Test
    fun `createFromSpanPacket with null parentId returns FormField`() {
        val startTime: Long = 1000
        val endTime: Long = 5000
        val checkpoint = TestData.getCheckpoint()
        fun expectedSerializedValue(): String {
            return "{\"name\":\"span-name\",\"trace_id\":\"trace-id\",\"span_id\":\"span-id\",\"parent_id\":null,\"session_id\":\"session-id\",\"start_time\":\"${startTime.iso8601Timestamp()}\",\"end_time\":\"${endTime.iso8601Timestamp()}\",\"duration\":4000,\"status\":1,\"attributes\":{\"key\":\"value\"},\"user_defined_attribute\":{\"user_key\":\"user_value\"},\"checkpoints\":[{\"name\":\"${checkpoint.name}\",\"timestamp\":\"${checkpoint.timestamp.iso8601Timestamp()}\"}]}"
        }

        // Given
        val attributes = mapOf("key" to "value")
        val userDefinedAttrs = mapOf("user_key" to "user_value")
        val spanEntity = TestData.getSpanEntity(
            spanId = "span-id",
            parentId = null,
            checkpoints = mutableListOf(checkpoint),
            startTime = startTime,
            endTime = endTime,
            duration = endTime - startTime,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
        )
        val spanPacket = TestData.getSpanPacket(spanEntity)

        // When
        val result = multipartDataFactory.createFromSpanPacket(spanPacket)

        // Then
        assert(result is MultipartData.FormField)
        val formField = result as MultipartData.FormField
        assertEquals(SPAN_FORM_NAME, formField.name)
        assertEquals(expectedSerializedValue(), formField.value)
    }

    private fun getFakeFileContent(): String {
        return "lorem ipsum dolor sit amet"
    }

    private fun InputStream.readAsString(): String {
        return bufferedReader().use { it.readText() }
    }
}
