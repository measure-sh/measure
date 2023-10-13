package sh.measure.android.storage

import android.content.ContentValues
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okio.appendingSink
import okio.buffer
import okio.sink
import okio.use
import org.jetbrains.annotations.TestOnly
import sh.measure.android.events.Event
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.Resource
import sh.measure.android.session.Session
import sh.measure.android.storage.SessionDbConstants.SessionTable
import java.io.File

/**
 * Stores sessions, resources and events to persistent storage.
 */
internal interface Storage {
    fun createSession(session: Session)
    fun getUnsyncedSessions(): List<UnsyncedSession>
    fun deleteSession(sessionId: String)
    fun deleteSyncedSessions()
    fun createResource(resource: Resource, sessionId: String)
    fun storeEvent(event: Event, sessionId: String)
    fun getSessionStartTime(sessionId: String): Long
    fun getResourceFile(id: String): File
    fun getEventsFile(sessionId: String): File
    fun getEventLogFile(sessionId: String): File
}

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

    @OptIn(ExperimentalSerializationApi::class)
    override fun createResource(resource: Resource, sessionId: String) {
        logger.log(LogLevel.Debug, "Saving resource: $resource")
        val resourceFile = fileHelper.getResourceFile(sessionId)
        resourceFile.sink().buffer().use {
            Json.encodeToStream(Resource.serializer(), resource, it.outputStream())
        }
    }

    override fun getUnsyncedSessions(): List<UnsyncedSession> {
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
            event.write(it)
        }
        logger.log(LogLevel.Debug, "Saved ${event.type} for session: $sessionId")
    }

    override fun getSessionStartTime(sessionId: String): Long {
        return db.getSessionStartTime(sessionId)
    }

    override fun getResourceFile(id: String): File {
        return fileHelper.getResourceFile(id)
    }

    override fun getEventsFile(sessionId: String): File {
        return fileHelper.getEventsJsonFile(sessionId)
    }

    override fun getEventLogFile(sessionId: String): File {
        return fileHelper.getEventLogFile(sessionId)
    }

    private fun deleteSessionFromDb(sessionId: String) {
        db.deleteSession(sessionId)
    }
}

@TestOnly
internal fun Session.toContentValues(): ContentValues {
    return ContentValues().apply {
        put(SessionTable.COLUMN_SESSION_ID, id)
        put(SessionTable.COLUMN_SESSION_START_TIME, startTime)
        put(SessionTable.COLUMN_SYNCED, synced)
        put(SessionTable.COLUMN_PROCESS_ID, pid)
    }
}

