package sh.measure.android.storage

import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.robolectric.RuntimeEnvironment
import sh.measure.android.fakes.NoopLogger
import java.io.File
import kotlin.io.path.pathString

class FileStorageTest {
    private val rootDir: String =
        RuntimeEnvironment.getTempDirectory().createIfNotExists("test").pathString
    private val fileStorage = FileStorageImpl(
        rootDir = rootDir,
        logger = NoopLogger(),
    )

    @After
    fun tearDown() {
        File(rootDir).deleteRecursively()
    }

    @Test
    fun `writes serialized exception data to a file`() {
        val eventId = "123"
        val serializedData = "serialized-data"
        fileStorage.writeEventData(eventId, serializedData)

        fileStorage.getFile("$rootDir/measure/$eventId")?.let { file ->
            assertTrue(file.exists())
            assertTrue(file.readText().isNotEmpty())
        }
    }

    @Test
    fun `writes serialized ANR data to a file`() {
        val eventId = "123"
        val serializedData = "serialized-data"
        fileStorage.writeEventData(eventId, serializedData)

        fileStorage.getFile("$rootDir/measure/$eventId")?.let { file ->
            assertTrue(file.exists())
            assertTrue(file.readText().isNotEmpty())
        }
    }

    @Test
    fun `returns null if file does not exist`() {
        val invalidPath = "invalid-path"
        val file = fileStorage.getFile(invalidPath)
        assertNull(file)
    }

    @Test
    fun `returns file if it exists`() {
        val eventId = "123"
        val serializedData = "serialized-data"
        fileStorage.writeEventData(eventId, serializedData)

        val file = fileStorage.getFile("$rootDir/measure/$eventId")
        assertNotNull(file)
    }

    @Test
    fun `deletes event and attachment files`() {
        val eventId = "123"
        val attachmentId = "456"
        val serializedData = "serialized-data"
        fileStorage.writeEventData(eventId, serializedData)
        fileStorage.writeAttachment(attachmentId, byteArrayOf(1, 2, 3))

        fileStorage.deleteEventIfExist(eventId, listOf(attachmentId))

        assertNull(fileStorage.getFile("$rootDir/measure/$eventId"))
        assertNull(fileStorage.getFile("$rootDir/measure/$attachmentId"))
    }

    @Test
    fun `deletes events and their attachment files`() {
        val eventId = "123"
        val attachmentId = "456"
        val serializedData = "serialized-data"
        fileStorage.writeEventData(eventId, serializedData)
        fileStorage.writeAttachment(attachmentId, byteArrayOf(1, 2, 3))

        fileStorage.deleteEventsIfExist(listOf(eventId), listOf(attachmentId))

        assertNull(fileStorage.getFile("$rootDir/measure/$eventId"))
        assertNull(fileStorage.getFile("$rootDir/measure/$attachmentId"))
    }
}
