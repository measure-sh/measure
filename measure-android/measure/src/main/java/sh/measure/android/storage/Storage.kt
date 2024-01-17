package sh.measure.android.storage

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okio.appendingSink
import okio.buffer
import okio.sink
import okio.use
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.events.Event
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.Session
import java.io.File
import java.io.IOException

internal const val MEASURE_DIR_NAME = "measure"
internal const val SESSIONS_DIR_NAME = "sessions"
internal const val ATTACHMENTS_DIR_NAME = "attachments"

internal const val EVENT_LOG_FILE_NAME = "event_log"
internal const val EVENTS_JSON_FILE_NAME = "events.json"
internal const val SESSION_FILE_NAME = "session.json"
internal const val ATTACHMENTS_LOG_FILE_NAME = "attachments_log"

/**
 * Stores sessions, resources and events to persistent storage.
 */
internal interface Storage {
    fun initSession(session: Session)
    fun deleteSession(sessionId: String)
    fun storeEvent(event: Event, sessionId: String)
    fun getAllSessions(): List<Session>
    fun getEventsFile(sessionId: String): File
    fun getEventLogFile(sessionId: String): File
    fun storeAttachmentInfo(info: AttachmentInfo, sessionId: String)
    fun getAllAttachmentsInfo(sessionId: String): List<AttachmentInfo>
    fun getAttachmentsDirPath(sessionId: String): String
}

internal class StorageImpl(private val logger: Logger, private val rootDirPath: String) : Storage {

    override fun initSession(session: Session) {
        logger.log(LogLevel.Debug, "Saving session: ${session.id}")
        createSessionFiles(session.id)
        persistSession(session)
    }

    override fun storeAttachmentInfo(info: AttachmentInfo, sessionId: String) {
        logger.log(LogLevel.Debug, "Saving attachment for session: $sessionId")
        val file = File(info.absolutePath)
        if (!file.exists() || file.nameWithoutExtension != info.name || file.extension != info.extension) {
            logger.log(
                LogLevel.Error,
                "Attachment ${info.name} does not exist or does not match the attachment info.",
            )
            return
        }

        val attachmentsFile = getAttachmentsLogFile(sessionId)
        val isFileEmpty = isFileEmpty(attachmentsFile)
        attachmentsFile.appendingSink().buffer().use {
            val attachmentJson = Json.encodeToString(AttachmentInfo.serializer(), info)
            if (!isFileEmpty) it.writeUtf8("\n")
            it.writeUtf8(attachmentJson)
        }
        logger.log(LogLevel.Debug, "Saved attachment for session: $sessionId")
    }

    override fun getAllAttachmentsInfo(sessionId: String): List<AttachmentInfo> {
        val attachmentsFile = getAttachmentsLogFile(sessionId)
        if (!attachmentsFile.exists()) {
            return emptyList()
        }
        return attachmentsFile.readLines().map {
            Json.decodeFromString(AttachmentInfo.serializer(), it)
        }
    }

    override fun getAllSessions(): List<Session> {
        return getAllSessionDirs().map {
            val sessionId = it.nameWithoutExtension
            val sessionFile = getSessionFile(sessionId)
            val session = Json.decodeFromString(Session.serializer(), sessionFile.readText())
            session
        }
    }

    override fun deleteSession(sessionId: String) {
        logger.log(LogLevel.Debug, "Deleting session: $sessionId")
        if (getSessionDir(sessionId).deleteRecursively()) {
            logger.log(LogLevel.Debug, "Deleted session: $sessionId")
        } else {
            logger.log(LogLevel.Error, "Failed to delete session: $sessionId")
        }
    }

    override fun storeEvent(event: Event, sessionId: String) {
        logger.log(LogLevel.Debug, "Saving ${event.type} for session: $sessionId")
        val isFileEmpty = isFileEmpty(getEventLogFile(sessionId))

        // write event to events file in format expected by server:
        // {"timestamp": "2021-03-03T12:00:00.000Z","type": "exception","exception": {...}}
        // Each line of events file contains a valid json event.
        // Adds a new line to mark the start of a new event if the file is not empty.
        getEventLogFile(sessionId).appendingSink().buffer().use {
            if (!isFileEmpty) it.writeUtf8("\n")
            event.write(it)
        }
        logger.log(LogLevel.Debug, "Saved ${event.type} for session: $sessionId")
    }

    override fun getEventsFile(sessionId: String): File {
        return getEventsJsonFile(sessionId)
    }

    override fun getEventLogFile(sessionId: String): File {
        return File(getEventLogFilePath(sessionId))
    }

    @OptIn(ExperimentalSerializationApi::class)
    private fun persistSession(session: Session) {
        val sessionFile = getSessionFile(sessionId = session.id)
        sessionFile.sink().buffer().use {
            Json.encodeToStream(Session.serializer(), session, it.outputStream())
        }
    }

    private fun createSessionFiles(sessionId: String) {
        val dir = File(getSessionDirPath(sessionId))
        if (!dir.exists()) {
            dir.mkdirs()
        }
        try {
            getEventLogFile(sessionId).createNewFile()
            getEventsJsonFile(sessionId).createNewFile()
            getSessionFile(sessionId).createNewFile()
            getAttachmentsDir(sessionId).mkdirs()
            getAttachmentsLogFile(sessionId).createNewFile()
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Failed to create resource and events files", e)
            // remove the session dir to keep the state consistent
            if (dir.exists()) {
                dir.delete()
            }
        }
    }

    private fun getAttachmentsLogFile(sessionId: String): File {
        return File(getAttachmentsLogFilePath(sessionId))
    }

    private fun getAttachmentsLogFilePath(sessionId: String) =
        "${getAttachmentsDirPath(sessionId)}/$ATTACHMENTS_LOG_FILE_NAME"

    private fun getAttachmentsDir(sessionId: String): File {
        return File(getAttachmentsDirPath(sessionId))
    }

    override fun getAttachmentsDirPath(sessionId: String): String {
        return "${getSessionDirPath(sessionId)}/$ATTACHMENTS_DIR_NAME"
    }

    private fun getEventsJsonFile(sessionId: String): File {
        return File(getEventsJsonFilePath(sessionId))
    }

    private fun isFileEmpty(file: File): Boolean {
        return file.length() == 0L
    }

    private fun getAllSessionDirs(): List<File> {
        return File(getSessionsDirPath()).listFiles()?.toList() ?: emptyList()
    }

    private fun getSessionFile(sessionId: String): File {
        return File(getSessionFilePath(sessionId))
    }

    private fun getSessionsDirPath(): String {
        return "$rootDirPath/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME"
    }

    private fun getEventLogFilePath(sessionId: String): String {
        return "${getSessionDirPath(sessionId)}/$EVENT_LOG_FILE_NAME"
    }

    private fun getEventsJsonFilePath(sessionId: String): String {
        return "${getSessionDirPath(sessionId)}/$EVENTS_JSON_FILE_NAME"
    }

    private fun getSessionDir(sessionId: String): File {
        return File(getSessionDirPath(sessionId))
    }

    private fun getSessionDirPath(sessionId: String): String {
        return "${getSessionsDirPath()}/$sessionId"
    }

    private fun getSessionFilePath(sessionId: String): String {
        return "${getSessionDirPath(sessionId)}/$SESSION_FILE_NAME"
    }
}
