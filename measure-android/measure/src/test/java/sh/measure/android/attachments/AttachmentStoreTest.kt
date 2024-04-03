package sh.measure.android.attachments

import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage

class AttachmentStoreTest {
    private val idProvider = FakeIdProvider()
    private val database = mock<Database>()
    private val fileStorage = mock<FileStorage>()

    private val attachmentStore = AttachmentStoreImpl(
        idProvider = idProvider,
        database = database,
        fileStorage = fileStorage,
    )

    @Test
    fun `returns the path of the method trace file created`() {
        val attachmentInfo = AttachmentInfo(
            name = "method-trace",
            extension = "trace",
            type = "method-trace",
            timestamp = 1234567890,
            attributes = mutableMapOf(),
        )

        val expectedPath = "path/to/method-trace.trace"
        `when`(fileStorage.createAttachmentFile(attachmentInfo.name)).thenReturn(expectedPath)

        val actualPath = attachmentStore.createMethodTraceFile(attachmentInfo)

        assertEquals(expectedPath, actualPath)
    }

    @Test
    fun `stores attachment info in the database`() {
        val attachmentInfo = AttachmentInfo(
            name = "method-trace",
            extension = "trace",
            type = "method-trace",
            timestamp = 1234567890,
            attributes = mutableMapOf("key" to "value"),
        )

        val path = "path/to/method-trace.trace"

        attachmentStore.storeAttachment(path, attachmentInfo)

        verify(database).insertAttachment(
            AttachmentEntity(
                id = idProvider.createId(),
                path = path,
                name = attachmentInfo.name,
                extension = attachmentInfo.extension,
                type = attachmentInfo.type,
                timestamp = attachmentInfo.timestamp,
                serializedAttributes = "{\"key\":\"value\"}"
            )
        )
    }
}