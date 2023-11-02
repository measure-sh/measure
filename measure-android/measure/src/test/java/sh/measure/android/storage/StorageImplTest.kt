package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToJsonElement
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
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
    fun `Storage returns resource if exists`() {
        val session = createFakeSession("session-id")
        storage.initSession(session)

        // When
        val actualResource = storage.getResource(session.id)

        // Then
        assertEquals(session.resource, actualResource)
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
            timestamp = timestamp, type = "event", data = data
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
                {"timestamp":"$timestamp","type":"event","event":"data"}
                {"timestamp":"$timestamp","type":"event","event":"data"}
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
