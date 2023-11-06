package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToJsonElement
import okio.buffer
import okio.sink
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.events.Event
import sh.measure.android.fakes.FakeResourceFactory
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.session.Resource
import sh.measure.android.session.Session
import sh.measure.android.utils.iso8601Timestamp
import java.io.File
import kotlin.io.path.pathString

@RunWith(AndroidJUnit4::class)
internal class StorageImplTest {
    private val logger = NoopLogger()
    private lateinit var storage: Storage
    private lateinit var rootDirPath: String

    @Before
    fun setUp() {
        rootDirPath = RuntimeEnvironment.getTempDirectory().createIfNotExists("test").pathString
        storage = StorageImpl(logger, rootDirPath)
    }

    @Test
    fun `Storage creates session directory and files on initialization`() {
        val session = createFakeSession("session-id")
        storage.initSession(session)

        // Expected directory structure:
        // measure/
        // |-- sessions/
        // |   |-- {session_id}/
        // |   |   |-- session.json
        // |   |   |-- events.json
        // |   |   |-- event_log
        // |   |   |-- attachments/
        // |   |   |   |-- attachments.json
        // |   |   |   |-- {name}.{extension}
        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        assertTrue(measureDir.exists())
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${session.id}")
        assertTrue(sessionDir.exists())
        val sessionFile = File(sessionDir, SESSION_FILE_NAME)
        assertTrue(sessionFile.exists())
        val eventsFile = File(sessionDir, EVENTS_JSON_FILE_NAME)
        assertTrue(eventsFile.exists())
        val eventLogFile = File(sessionDir, EVENT_LOG_FILE_NAME)
        assertTrue(eventLogFile.exists())
        val attachmentsDir = File(sessionDir, ATTACHMENTS_DIR_NAME)
        assertTrue(attachmentsDir.exists())
        val attachmentsFile = File(attachmentsDir, ATTACHMENTS_LOG_FILE_NAME)
        assertTrue(attachmentsFile.exists())
    }

    @Test
    fun `Storage persists session on initialization`() {
        val session = createFakeSession("session-id")
        storage.initSession(session)
        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${session.id}")
        val sessionFile = File(sessionDir, SESSION_FILE_NAME)

        assertEquals(session, Json.decodeFromString(Session.serializer(), sessionFile.readText()))
    }

    @Test
    fun `Storage returns all sessions if available`() {
        val session1 = createFakeSession("session1")
        val session2 = createFakeSession("session2")
        storage.initSession(session1)
        storage.initSession(session2)

        val sessions = storage.getAllSessions()

        assertEquals(2, sessions.size)
        assertTrue(sessions.contains(session1))
        assertTrue(sessions.contains(session2))
    }

    @Test
    fun `Storage returns empty sessions if no sessions available`() {
        val sessions = storage.getAllSessions()

        assertEquals(0, sessions.size)
    }

    @Test
    fun `Storage deletes session directory`() {
        val sessionId = "session-id"
        storage.initSession(createFakeSession(sessionId))

        storage.deleteSession(sessionId)

        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        assertFalse(sessionDir.exists())
    }

    @Test
    fun `Storage stores each event on a new line in event log file`() {
        val sessionId = "id"
        val data: JsonElement = Json.encodeToJsonElement("data")
        val timestamp = 9876543210.iso8601Timestamp()
        val event = Event(
            timestamp = timestamp, type = "event", data = data, thread_name = "thread"
        )
        storage.initSession(createFakeSession(sessionId))

        // When
        storage.storeEvent(event, sessionId)
        storage.storeEvent(event, sessionId)

        // Then
        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        val eventLogFile = File(sessionDir, EVENT_LOG_FILE_NAME)
        assertEquals(
            """
                {"timestamp":"$timestamp","type":"event","event":"data","thread_name":"thread"}
                {"timestamp":"$timestamp","type":"event","event":"data","thread_name":"thread"}
            """.trimIndent(), eventLogFile.readText()
        )
    }


    @Test
    fun `Storage delegates returns events json file`() {
        val sessionId = "id"

        // When
        val actualEventsFile = storage.getEventsFile(sessionId)

        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        val eventsFile = File(sessionDir, EVENTS_JSON_FILE_NAME)
        // Then
        assertEquals(eventsFile, actualEventsFile)
    }

    @Test
    fun `Storage returns event log file`() {
        val sessionId = "id"

        // When
        val actualEventLogFile = storage.getEventLogFile(sessionId)

        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        val eventLogFile = File(sessionDir, EVENT_LOG_FILE_NAME)
        // Then
        assertEquals(eventLogFile, actualEventLogFile)
    }

    @Test
    fun `Storage stores each attachment on a new line to attachments log file, given the attachment exists at absolutePath`() {
        val sessionId = "id"
        val attachmentPath = "$rootDirPath/attachment.txt"
        val attachment = AttachmentInfo(
            absolutePath = attachmentPath,
            name = "attachment",
            extension = "txt",
            type = "type",
            timestamp = 0L,
        )
        File(attachmentPath).writeText("test attachment")
        storage.initSession(createFakeSession(sessionId))

        // When
        storage.storeAttachmentInfo(attachment, sessionId)
        storage.storeAttachmentInfo(attachment, sessionId)

        // Then
        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        val attachmentDir = File(sessionDir, ATTACHMENTS_DIR_NAME)
        val attachmentsLogFile = File(attachmentDir, ATTACHMENTS_LOG_FILE_NAME)
        assertEquals(
            """
                {"absolutePath":"${attachment.absolutePath}","name":"${attachment.name}","extension":"${attachment.extension}","type":"${attachment.type}","timestamp":${attachment.timestamp}}
                {"absolutePath":"${attachment.absolutePath}","name":"${attachment.name}","extension":"${attachment.extension}","type":"${attachment.type}","timestamp":${attachment.timestamp}}
            """.trimIndent(), attachmentsLogFile.readText()
        )
    }

    @Test
    fun `Storage does not store attachment to attachments log file, if the name of file doesn't match the info`() {
        val sessionId = "id"
        val filePath = "$rootDirPath/attachment.txt"
        val attachment = AttachmentInfo(
            absolutePath = filePath,
            name = "file",
            extension = "txt",
            type = "type",
            timestamp = 0L,
        )
        File(filePath).writeText("test attachment")
        storage.initSession(createFakeSession(sessionId))

        // When
        storage.storeAttachmentInfo(attachment, sessionId)

        // Then
        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        val attachmentDir = File(sessionDir, ATTACHMENTS_DIR_NAME)
        val attachmentsLogFile = File(attachmentDir, ATTACHMENTS_LOG_FILE_NAME)
        assertEquals("", attachmentsLogFile.readText())
    }

    @Test
    fun `Storage does not store attachment to attachments log file, if the extension of file doesn't match the info`() {
        val sessionId = "id"
        val filePath = "$rootDirPath/attachment.txt"
        val attachment = AttachmentInfo(
            absolutePath = filePath,
            name = "attachment",
            extension = "png",
            type = "type",
            timestamp = 0L,
        )
        File(filePath).writeText("test attachment")
        storage.initSession(createFakeSession(sessionId))

        // When
        storage.storeAttachmentInfo(attachment, sessionId)

        // Then
        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        val attachmentDir = File(sessionDir, ATTACHMENTS_DIR_NAME)
        val attachmentsLogFile = File(attachmentDir, ATTACHMENTS_LOG_FILE_NAME)
        assertEquals("", attachmentsLogFile.readText())
    }

    @Test
    fun `Storage does not store attachment to attachments log file, if the attachment does not exist at absolutePath`() {
        val sessionId = "id"
        val attachment = AttachmentInfo(
            absolutePath = "no_file_on_this_path",
            name = "file",
            extension = "txt",
            type = "type",
            timestamp = 0L,
        )
        storage.initSession(createFakeSession(sessionId))

        // When
        storage.storeAttachmentInfo(attachment, sessionId)
        storage.storeAttachmentInfo(attachment, sessionId)

        // Then
        val measureDir = File(rootDirPath, MEASURE_DIR_NAME)
        val sessionDir = File(measureDir, "$SESSIONS_DIR_NAME/${sessionId}")
        val attachmentDir = File(sessionDir, ATTACHMENTS_DIR_NAME)
        val attachmentsLogFile = File(attachmentDir, ATTACHMENTS_LOG_FILE_NAME)
        assertEquals("", attachmentsLogFile.readText())
    }

    @Test
    fun `Storage returns empty list if no attachments are available`() {
        val sessionId = "id"
        storage.initSession(createFakeSession(sessionId))

        // When
        val attachments = storage.getAllAttachmentsInfo(sessionId)

        // Then
        assertEquals(0, attachments.size)
    }

    @Test
    fun `Storage returns all attachments if attachments are available`() {
        val sessionId = "id"
        storage.initSession(createFakeSession(sessionId))
        val attachmentsDir =
            "$rootDirPath/${MEASURE_DIR_NAME}/$SESSIONS_DIR_NAME/$sessionId/${ATTACHMENTS_DIR_NAME}"
        val attachment1 = AttachmentInfo(
            absolutePath = "$attachmentsDir/attachment1.txt",
            name = "attachment1",
            extension = "txt",
            type = "type",
            timestamp = 0L,
        )
        val attachment2 = AttachmentInfo(
            absolutePath = "$attachmentsDir/attachment2.txt",
            name = "attachment2",
            extension = "txt",
            type = "type",
            timestamp = 0L,
        )
        File(attachmentsDir, "${attachment1.name}.${attachment1.extension}").writeText("test attachment 1")
        File(attachmentsDir, "${attachment2.name}.${attachment2.extension}").writeText("test attachment 2")
        File(attachmentsDir, ATTACHMENTS_LOG_FILE_NAME).sink().buffer().use {
            it.writeUtf8(Json.encodeToString(AttachmentInfo.serializer(), attachment1))
            it.writeUtf8("\n")
            it.writeUtf8(Json.encodeToString(AttachmentInfo.serializer(), attachment2))
        }

        // When
        val attachments = storage.getAllAttachmentsInfo(sessionId)

        // Then
        assertEquals(2, attachments.size)
        assertTrue(attachments.contains(attachment1))
        assertTrue(attachments.contains(attachment2))
    }

    private fun createFakeSession(
        id: String, resource: Resource = FakeResourceFactory().resource
    ): Session {
        return Session(
            id = id,
            startTime = 0,
            resource = resource,
            pid = 0,
        )
    }
}
