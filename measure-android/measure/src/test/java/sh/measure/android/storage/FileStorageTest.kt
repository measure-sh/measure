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
        logger = NoopLogger()
    )

    @After
    fun tearDown() {
        File(rootDir).deleteRecursively()
    }

    @Test
    fun `creates a file in exceptions directory`() {
        val eventId = "123"
        val path = fileStorage.createExceptionFile(eventId)

        assertNotNull(path)
        assertTrue(path!!.endsWith("measure/exceptions/$eventId"))
        val file = File(path)
        assertTrue(file.exists())
    }

    @Test
    fun `creates a file in anr directory`() {
        val eventId = "123"
        val path = fileStorage.createAnrPath(eventId)

        assertNotNull(path)
        assertTrue(path!!.endsWith("measure/anr/$eventId"))
        val file = File(path)
        assertTrue(file.exists())
    }

    @Test
    fun `returns null, if file already exists`() {
        val eventId = "123"
        val result1 = fileStorage.createExceptionFile(eventId)
        assertNotNull(result1)

        val result2 = fileStorage.createExceptionFile(eventId)
        assertNull(result2)
    }

    @Test
    fun `writes exception data to file if it exists`() {
        val eventId = "123"
        val path = fileStorage.createExceptionFile(eventId)
        assertNotNull(path)

        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)
        fileStorage.writeException(path!!, event)

        val file = File(path)
        assertTrue(file.exists())
        assertTrue(file.readText().isNotEmpty())
    }

    @Test
    fun `does not write when file does not exist`() {
        val invalidPath = "invalid-path"
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)
        fileStorage.writeException(invalidPath, event)

        val file = File(rootDir, invalidPath)
        assertFalse(file.exists())
    }

    @Test
    fun `returns file if it exists`() {
        val eventId = "123"
        val path = fileStorage.createExceptionFile(eventId)
        assertNotNull(path)

        val file = fileStorage.getFile(path!!)
        assertNotNull(file)
        assertTrue(file!!.exists())
    }

    @Test
    fun `returns null if file does not exist`() {
        val invalidPath = "invalid-path"
        val file = fileStorage.getFile(invalidPath)
        assertNull(file)
    }
}