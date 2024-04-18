package sh.measure.android.storage

import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.robolectric.RuntimeEnvironment
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent
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
        fileStorage.writeException(eventId, serializedData)

        fileStorage.getFile("$rootDir/measure/exceptions/$eventId")?.let { file ->
            assertTrue(file.exists())
            assertTrue(file.readText().isNotEmpty())
        }
    }

    @Test
    fun `writes serialized ANR data to a file`() {
        val eventId = "123"
        val serializedData = "serialized-data"
        fileStorage.writeAnr(eventId, serializedData)

        fileStorage.getFile("$rootDir/measure/anr/$eventId")?.let { file ->
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
        fileStorage.writeException(eventId, serializedData)

        val file = fileStorage.getFile("$rootDir/measure/exceptions/$eventId")
        assertNotNull(file)
    }
}
