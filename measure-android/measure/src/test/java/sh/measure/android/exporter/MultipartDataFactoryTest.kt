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
        val eventEntity =
            TestData.getEventEntity(eventId = "event-id", serializedData = "serialized-data")
        val eventPacket = TestData.getEventPacket(eventEntity)
        val result = multipartDataFactory.createFromEventPacket(eventPacket)

        assert(result is MultipartData.FormField)
        assertEquals(EVENT_FORM_NAME, (result as MultipartData.FormField).name)
        assertEquals(eventPacket.asFormDataPart(), result.value)
    }

    @Test
    fun `createFromEventPacket with filePath returns FileData`() {
        val eventEntity = TestData.getEventEntity(
            eventId = "event-id",
            filePath = "/path/to/file.json",
            serializedData = null,
        )
        val eventPacket = TestData.getEventPacket(eventEntity)

        `when`(fileStorage.getFile("/path/to/file.json")).thenReturn(fakeFile)

        val result = multipartDataFactory.createFromEventPacket(eventPacket)

        assert(result is MultipartData.FileData)
        assertEquals(EVENT_FORM_NAME, (result as MultipartData.FileData).name)
        assertEquals("event-id", result.filename)
        assertEquals("application/json", result.contentType)
        assertEquals(getFakeFileContent(), result.inputStream.readAsString())
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
        assertEquals("application/octet-stream", result.contentType)
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
