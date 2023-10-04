package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToJsonElement
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.robolectric.RuntimeEnvironment
import sh.measure.android.events.Event
import sh.measure.android.fakes.FakeResourceFactory
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.session.Resource
import sh.measure.android.session.Session
import sh.measure.android.session.SessionReport
import sh.measure.android.utils.iso8601Timestamp
import java.io.File
import kotlin.io.path.pathString

@RunWith(AndroidJUnit4::class)
internal class StorageImplTest {
    private val logger = NoopLogger()
    private val dbHelper = mock<DbHelper>()
    private val fileHelper = mock<FileHelperImpl>()
    private val storage: Storage = StorageImpl(logger, fileHelper, dbHelper)
    private val tempDirPath =
        RuntimeEnvironment.getTempDirectory().createIfNotExists("test").pathString

    @Test
    fun `Storage delegates to db and file helper to create session`() {
        val session =
            Session(id = "id", startTime = 9876543210, resource = FakeResourceFactory().create())
        // When
        storage.createSession(session)

        // Then
        verify(dbHelper).createSession(session.toContentValues())
        verify(fileHelper).createSessionFiles(session.id)
    }

    @Test
    fun `Storage serializes and writes resource to file`() {
        val resource = FakeResourceFactory().resource
        val resourceFile = File(tempDirPath, "resource.json")
        `when`(fileHelper.getResourceFile("id")).thenReturn(resourceFile)
        // When
        storage.createResource(resource, "id")

        // Then
        assertEquals(
            resource, Json.decodeFromString(Resource.serializer(), resourceFile.readText())
        )
    }

    @Test
    fun `Storage delegates to db to return unsynced sessions`() {
        val sessionId = "id"
        `when`(dbHelper.getUnsyncedSessions()).thenReturn(listOf(sessionId))
        // When
        val syncedSessions = storage.getUnsyncedSessions()

        // Then
        assertEquals(listOf(sessionId), syncedSessions)
    }

    @Test
    fun `Storage deletes session from db and files`() {
        val sessionId = "id"
        // When
        storage.deleteSession(sessionId)

        // Then
        verify(dbHelper).deleteSession(sessionId)
        verify(fileHelper).deleteSession(sessionId)
    }

    @Test
    fun `Storage deletes synced sessions from db and files`() {
        val sessionId1 = "id1"
        val sessionId2 = "id2"
        `when`(dbHelper.getSyncedSessions()).thenReturn(listOf(sessionId1, sessionId2))
        // When
        storage.deleteSyncedSessions()

        // Then
        verify(dbHelper).deleteSessions(listOf(sessionId1, sessionId2))
        verify(fileHelper).deleteSession(sessionId1)
        verify(fileHelper).deleteSession(sessionId2)
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
                {"timestamp": "$timestamp","type": "event","event": "data"}
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
               
               {"timestamp": "$timestamp","type": "event","event": "data"}
            """.trimIndent(), eventLogFile.readText()
        )
    }

    @Test
    fun `Storage returns the session report`() {
        // Given
        val sessionId = "id"
        val time: Long = 1231231
        `when`(dbHelper.getSessionStartTime(sessionId)).thenReturn(time)
        val eventLogFile = File(tempDirPath, "event_log")
        eventLogFile.writeText(
            """
                {"timestamp": "1970-04-25T12:59:03.000000210Z","type": "event","event": "data"}
            """.trimIndent()
        )
        val eventJsonFile = File(tempDirPath, "events.json")
        val resourceFile = File(tempDirPath, "resource.json")
        `when`(fileHelper.getEventLogFile(sessionId)).thenReturn(eventLogFile)
        `when`(fileHelper.getEventsJsonFile(sessionId)).thenReturn(eventJsonFile)
        `when`(fileHelper.getResourceFile(sessionId)).thenReturn(resourceFile)
        val expectedSessionReport = SessionReport(
            session_id = sessionId,
            timestamp = time.iso8601Timestamp(),
            resourceFile = resourceFile,
            eventsFile = eventJsonFile
        )

        // When
        val sessionReport = storage.getSessionReport(sessionId)

        assertEquals(expectedSessionReport, sessionReport)
    }
}