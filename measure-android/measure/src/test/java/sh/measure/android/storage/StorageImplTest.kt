package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToJsonElement
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import org.robolectric.RuntimeEnvironment
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
    private val fileHelper = mock<FileHelperImpl>()
    private lateinit var storage: Storage
    private lateinit var tempDirPath: String

    @Before
    fun setUp() {
        storage = StorageImpl(logger, fileHelper)
        tempDirPath = RuntimeEnvironment.getTempDirectory().createIfNotExists("test").pathString
    }

    @Test
    fun `Storage delegates to file helper to create session files and persists session to session file`() {
        val session = createFakeSession("session-id")
        val file = File(tempDirPath, "session.json")
        `when`(fileHelper.getSessionFile(session.id)).thenReturn(file)

        storage.storeSession(session)

        verify(fileHelper).createSessionFiles(session.id)
        assertEquals(
            Json.encodeToString(Session.serializer(), session), file.readText()
        )
    }

    @Test
    fun `Storage returns resource if exists`() {
        val sessionId = "session-id"
        val resource = FakeResourceFactory().resource
        val session = createFakeSession(sessionId, resource)
        val sessionFile = File(tempDirPath, "session.json")
        `when`(fileHelper.getSessionFile(session.id)).thenReturn(sessionFile)
        sessionFile.writeText(Json.encodeToJsonElement(session).toString())

        // When
        val actualResource = storage.getResource(sessionId)

        // Then
        assertEquals(resource, actualResource)
    }

    @Test
    fun `Storage returns all sessions if available`() {
        val session1 = createFakeSession("session1")
        val session2 = createFakeSession("session2")
        val dir1 = createFakeSessionDir(session1)
        val dir2 = createFakeSessionDir(session2)
        // write session to file
        val sessionFile1 = File(dir1, "session.json")
        sessionFile1.writeText(Json.encodeToJsonElement(session1).toString())
        val sessionFile2 = File(dir2, "session.json")
        sessionFile2.writeText(Json.encodeToJsonElement(session2).toString())

        `when`(fileHelper.getAllSessionDirs()).thenReturn(listOf(dir1, dir2))
        `when`(fileHelper.getSessionFile(session1.id)).thenReturn(sessionFile1)
        `when`(fileHelper.getSessionFile(session2.id)).thenReturn(sessionFile2)

        val sessions = storage.getAllSessions()

        assertEquals(2, sessions.size)
        assertTrue(sessions.contains(session1))
        assertTrue(sessions.contains(session2))
    }

    @Test
    fun `Storage returns empty sessions if no sessions available`() {
        `when`(fileHelper.getAllSessionDirs()).thenReturn(listOf())

        val sessions = storage.getAllSessions()

        assertEquals(0, sessions.size)
    }

    @Test
    fun `Storage delegates to file helper to delete session`() {
        val sessionId = "session-id"
        storage.deleteSession(sessionId)
        verify(fileHelper).deleteSession(sessionId)
    }

    @Test
    fun `Storage writes the event to event log, when event log file is empty`() {
        val sessionId = "id"
        val data: JsonElement = Json.encodeToJsonElement("data")
        val timestamp = 9876543210.iso8601Timestamp()
        val event = Event(
            timestamp = timestamp, type = "event", data = data
        )
        `when`(fileHelper.isEventLogEmpty(sessionId)).thenReturn(true)
        val eventLogFile = File(tempDirPath, "event_log")
        `when`(fileHelper.getEventLogFile(sessionId)).thenReturn(
            eventLogFile
        )

        // When
        storage.storeEvent(event, sessionId)

        // Then
        assertEquals(
            """
                {"timestamp":"$timestamp","type":"event","event":"data"}
            """.trimIndent(), eventLogFile.readText()
        )
    }

    @Test
    fun `Storage appends event to event log, when event log file is not empty`() {
        val sessionId = "id"
        val data: JsonElement = Json.encodeToJsonElement("data")
        val timestamp = 9876543210.iso8601Timestamp()
        val event = Event(
            timestamp = timestamp, type = "event", data = data
        )
        `when`(fileHelper.isEventLogEmpty(sessionId)).thenReturn(false)
        val eventLogFile = File(tempDirPath, "event_log")
        `when`(fileHelper.getEventLogFile(sessionId)).thenReturn(
            eventLogFile
        )

        // When
        storage.storeEvent(event, sessionId)

        // Then
        assertEquals(
            """

               {"timestamp":"$timestamp","type":"event","event":"data"}
            """.trimIndent(), eventLogFile.readText()
        )
    }

    @Test
    fun `Storage delegates to file helper return resource`() {

    }

    @Test
    fun `Storage delegates to file helper to return events file`() {
        val sessionId = "id"
        val eventsFile = File(tempDirPath, "events.json")
        `when`(fileHelper.getEventsJsonFile(sessionId)).thenReturn(eventsFile)

        // When
        val actualEventsFile = storage.getEventsFile(sessionId)

        // Then
        assertEquals(eventsFile, actualEventsFile)
    }

    @Test
    fun `Storage delegates to file helper to return event log file`() {
        val sessionId = "id"
        val eventsFile = File(tempDirPath, "events.json")
        `when`(fileHelper.getEventLogFile(sessionId)).thenReturn(eventsFile)

        // When
        val actualEventsFile = storage.getEventLogFile(sessionId)

        // Then
        assertEquals(eventsFile, actualEventsFile)
    }

    private fun createFakeSessionDir(session: Session): File {
        val sessionDir = File(tempDirPath, session.id)
        sessionDir.mkdirs()
        return sessionDir
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
