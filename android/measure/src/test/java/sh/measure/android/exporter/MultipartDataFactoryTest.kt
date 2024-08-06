package sh.measure.android.exporter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.kotlin.mock
import sh.measure.android.exporter.MultipartDataFactoryImpl.Companion.ATTACHMENT_NAME_PREFIX
import sh.measure.android.exporter.MultipartDataFactoryImpl.Companion.EVENT_FORM_NAME
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage
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
            return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"$type\",\"$type\":$serializedData,\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes}"
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
            return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"$type\",\"$type\":${getFakeFileContent()},\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes}"
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

    private fun getFakeFileContent(): String {
        return "lorem ipsum dolor sit amet"
    }

    private fun InputStream.readAsString(): String {
        return bufferedReader().use { it.readText() }
    }
}
