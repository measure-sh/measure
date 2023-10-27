package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
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
    fun `FileHelper creates a new directory with name session_id and all the session files`() {
        val sessionId = "session_id"
        val expectedSessionDirPath =
            "${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId"

        // When
        fileHelper.createSessionFiles(sessionId)

        // Then
        val sessionDir = File(expectedSessionDirPath)
        assertTrue(sessionDir.exists())
        assertTrue(sessionDir.isDirectory)
        assertEquals(sessionId, sessionDir.nameWithoutExtension)

        val session =
            File("${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$SESSION_FILE_NAME")
        val eventLog =
            File("${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$EVENT_LOG_FILE_NAME")
        val events =
            File("${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$EVENTS_JSON_FILE_NAME")
        assertTrue(session.exists())
        assertTrue(eventLog.exists())
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

    @Test
    fun `FileHelper returns events json file`() {
        val sessionId = "session_id"
        val expectedPath =
            "${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$EVENTS_JSON_FILE_NAME"
        fileHelper.createSessionFiles(sessionId)

        // When
        val file = fileHelper.getEventsJsonFile(sessionId)

        // Then
        assertEquals(
            expectedPath,
            file.path
        )
    }

    @Test
    fun `FileHelper returns event log file`() {
        val sessionId = "session_id"
        val expectedPath =
            "${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$EVENT_LOG_FILE_NAME"
        fileHelper.createSessionFiles(sessionId)

        // When
        val file = fileHelper.getEventLogFile(sessionId)

        // Then
        assertEquals(
            expectedPath,
            file.path
        )
    }

    @Test
    fun `FileHelper returns session file`() {
        val sessionId = "session_id"
        val expectedPath =
            "${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME/$sessionId/$SESSION_FILE_NAME"
        fileHelper.createSessionFiles(sessionId)

        // When
        val file = fileHelper.getSessionFile(sessionId)

        // Then
        assertEquals(
            expectedPath,
            file.path
        )
    }

    @Test
    fun `FileHelper returns all session directories if available`() {
        val sessionId1 = "session_id_1"
        fileHelper.createSessionFiles(sessionId1)
        val sessionId2 = "session_id_2"
        fileHelper.createSessionFiles(sessionId2)

        // When
        val files = fileHelper.getAllSessionDirs()

        // Then
        assertEquals(2, files.size)
    }

    @Test
    fun `FileHelper returns empty list if session directories are not available`() {
        val sessionId1 = "session_id_1"
        fileHelper.createSessionFiles(sessionId1)
        val sessionId2 = "session_id_2"
        fileHelper.createSessionFiles(sessionId2)

        // When
        val files = fileHelper.getAllSessionDirs()

        // Then
        assertEquals(2, files.size)
    }
}