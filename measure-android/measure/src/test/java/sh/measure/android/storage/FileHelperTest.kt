package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import sh.measure.android.fakes.NoopLogger
import java.io.File

@RunWith(AndroidJUnit4::class)
internal class FileHelperTest {
    private val logger = NoopLogger()
    private lateinit var fileHelper: FileHelperImpl
    private val context = RuntimeEnvironment.getApplication()
    private lateinit var rootDir: File

    @Before
    fun setUp() {
        fileHelper = FileHelperImpl(logger, context)
        rootDir = context.filesDir
    }

    @Test
    fun `FileHelper creates a new session_id directory with event and resource files`() {
        val sessionId = "session_id"
        // When
        fileHelper.createSessionFiles(sessionId)

        // Then
        val resource =
            File("${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$RESOURCE_FILE_NAME")
        val events =
            File("${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$EVENT_LOG_FILE_NAME")
        assertTrue(resource.exists())
        assertTrue(events.exists())
    }

    @Test
    fun `FileHelper deletes session directory for given session id`() {
        val sessionId = "session_id"
        fileHelper.createSessionFiles(sessionId)
        // When
        fileHelper.deleteSession(sessionId)

        // Then
        val sessionDir = File("${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId")
        assertTrue(!sessionDir.exists())
    }

    @Test
    fun `FileHelper returns true if event log is empty`() {
        val sessionId = "session_id"
        fileHelper.createSessionFiles(sessionId)
        // When
        val isEmpty = fileHelper.isEventLogEmpty(sessionId)

        // Then
        assertTrue(isEmpty)
    }

    @Test
    fun `FileHelper returns false if event log is not empty`() {
        val sessionId = "session_id"
        fileHelper.createSessionFiles(sessionId)
        fileHelper.getEventLogFile(sessionId).writeText("test")

        // When
        val isEmpty = fileHelper.isEventLogEmpty(sessionId)

        // Then
        assertFalse(isEmpty)
    }
}