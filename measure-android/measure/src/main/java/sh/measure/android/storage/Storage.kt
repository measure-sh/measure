package sh.measure.android.storage

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okio.appendingSink
import okio.buffer
import okio.sink
import okio.use
import sh.measure.android.events.Event
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.Resource
import sh.measure.android.session.Session
import java.io.File

/**
 * Stores sessions, resources and events to persistent storage.
 */
internal interface Storage {
    fun storeSession(session: Session)
    fun deleteSession(sessionId: String)
    fun storeEvent(event: Event, sessionId: String)
    fun getAllSessions(): List<Session>
    fun getEventsFile(sessionId: String): File
    fun getEventLogFile(sessionId: String): File
    fun getResource(sessionId: String): Resource
}

internal class StorageImpl(
    private val logger: Logger,
    private val fileHelper: FileHelper,
) : Storage {

    @OptIn(ExperimentalSerializationApi::class)
    override fun storeSession(session: Session) {
        logger.log(LogLevel.Debug, "Saving session: ${session.id}")
        fileHelper.createSessionFiles(session.id)
        val sessionFile = fileHelper.getSessionFile(sessionId = session.id)
        sessionFile.sink().buffer().use {
            Json.encodeToStream(Session.serializer(), session, it.outputStream())
        }
    }

    override fun getResource(sessionId: String): Resource {
        val sessionFile = fileHelper.getSessionFile(sessionId)
        return Json.decodeFromString(Session.serializer(), sessionFile.readText()).resource
    }

    override fun getAllSessions(): List<Session> {
        return fileHelper.getAllSessionDirs().map {
            val sessionId = it.nameWithoutExtension
            val sessionFile = fileHelper.getSessionFile(sessionId)
            val session = Json.decodeFromString(Session.serializer(), sessionFile.readText())
            session
        }
    }

    override fun deleteSession(sessionId: String) {
        logger.log(LogLevel.Debug, "Deleting session: $sessionId")
        fileHelper.deleteSession(sessionId)
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

    override fun getEventsFile(sessionId: String): File {
        return fileHelper.getEventsJsonFile(sessionId)
    }

    override fun getEventLogFile(sessionId: String): File {
        return fileHelper.getEventLogFile(sessionId)
    }
}
