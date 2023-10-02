package sh.measure.android.storage

import android.content.ContentValues
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToStream
import okio.appendingSink
import okio.buffer
import okio.sink
import okio.source
import okio.use
import org.jetbrains.annotations.TestOnly
import sh.measure.android.events.Event
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.Resource
import sh.measure.android.session.Session
import sh.measure.android.session.SessionReport
import sh.measure.android.storage.SessionDbConstants.SessionTable
import sh.measure.android.utils.iso8601Timestamp
import java.io.File

/**
 * Stores sessions, resources and events to persistent storage.
 */
internal interface Storage {
    fun createSession(session: Session)
    fun getSessionReport(sessionId: String): SessionReport
    fun getUnsyncedSessions(): List<String>
    fun deleteSession(sessionId: String)
    fun deleteSyncedSessions()
    fun createResource(resource: Resource, sessionId: String)
    fun storeEvent(event: Event, sessionId: String)
}

@OptIn(ExperimentalSerializationApi::class)
internal class StorageImpl(
    private val logger: Logger,
    private val fileHelper: FileHelper,
    private val db: DbHelper,
) : Storage {
    override fun createSession(session: Session) {
        logger.log(LogLevel.Debug, "Saving session: ${session.id}")
        db.createSession(session.toContentValues())
        fileHelper.createSessionFiles(session.id)
    }

    override fun createResource(resource: Resource, sessionId: String) {
        logger.log(LogLevel.Debug, "Saving resource: $resource")
        val resourceFile = fileHelper.getResourceFile(sessionId)
        resourceFile.sink().buffer().use {
            Json.encodeToStream(Resource.serializer(), resource, it.outputStream())
        }
    }

    override fun getSessionReport(sessionId: String): SessionReport {
        logger.log(LogLevel.Debug, "Getting session report for session: $sessionId")
        val sessionStartTime = getSessionStartTime(sessionId)
        val eventsFile = createEventsJsonFile(sessionId)
        val resourceFile = fileHelper.getResourceFile(sessionId)
        return SessionReport(
            session_id = sessionId,
            timestamp = sessionStartTime.iso8601Timestamp(),
            eventsFile = eventsFile,
            resourceFile = resourceFile
        )
    }

    override fun getUnsyncedSessions(): List<String> {
        return db.getUnsyncedSessions()
    }

    override fun deleteSession(sessionId: String) {
        fileHelper.deleteSession(sessionId)
        deleteSessionFromDb(sessionId)
    }

    override fun deleteSyncedSessions() {
        // get synced sessions from db
        val syncedSessions = db.getSyncedSessions()
        if (syncedSessions.isEmpty()) {
            return
        }
        // delete directories for synced sessions
        syncedSessions.forEach { sessionId ->
            fileHelper.deleteSession(sessionId)
        }
        // delete synced sessions from db
        db.deleteSessions(syncedSessions)
    }

    override fun storeEvent(event: Event, sessionId: String) {
        logger.log(LogLevel.Debug, "Saving ${event.type} for session: $sessionId")
        val isFileEmpty = fileHelper.isEventLogEmpty(sessionId)

        // write event to events file in format expected by server:
        // {"timestamp": "2021-03-03T12:00:00.000Z","type": "exception","exception": {...}}
        // Each line of events file contains a valid json event.
        // Adds a new line to mark the start of a new event if the file is not empty.
        fileHelper.getEventLogFile(sessionId).appendingSink().buffer().use {
            if (!isFileEmpty) it.writeUtf8("\n")
            it.writeUtf8("{")
            it.writeUtf8("\"timestamp\": \"${event.timestamp}\",")
            it.writeUtf8("\"type\": \"${event.type}\",")
            it.writeUtf8("\"${event.type}\": ")
            Json.encodeToStream(JsonElement.serializer(), event.data, it.outputStream())
            it.writeUtf8("}")
        }
        logger.log(LogLevel.Debug, "Saved ${event.type} for session: $sessionId")
    }

    private fun deleteSessionFromDb(sessionId: String) {
        db.deleteSession(sessionId)
    }

    private fun getSessionStartTime(sessionId: String): Long {
        return db.getSessionStartTime(sessionId)
    }

    private fun createEventsJsonFile(sessionId: String): File {
        logger.log(LogLevel.Debug, "Creating events.json file for session: $sessionId")
        fileHelper.getEventLogFile(sessionId).source().buffer().use { source ->
            fileHelper.getEventsJsonFile(sessionId).sink().buffer().use { sink ->
                sink.writeUtf8("[")
                var line = source.readUtf8Line()
                while (line != null) {
                    sink.writeUtf8(line)
                    line = source.readUtf8Line()
                    if (line != null) sink.writeUtf8(",")
                }
                sink.writeUtf8("]")
            }
        }
        logger.log(LogLevel.Debug, "Created events.json file for session: $sessionId")
        return fileHelper.getEventsJsonFile(sessionId)
    }
}

@TestOnly
internal fun Session.toContentValues(): ContentValues {
    return ContentValues().apply {
        put(SessionTable.COLUMN_SESSION_ID, id)
        put(SessionTable.COLUMN_SESSION_START_TIME, startTime)
        put(SessionTable.COLUMN_SYNCED, synced)
    }
}

