package sh.measure.android.storage

import android.content.Context
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.File
import java.io.IOException

internal const val MEASURE_DIR_NAME = "measure"
internal const val SESSIONS_DIR_NAME = "sessions"
internal const val EVENT_LOG_FILE_NAME = "event_log"
internal const val EVENTS_JSON_FILE_NAME = "events.json"
internal const val RESOURCE_FILE_NAME = "resource.json"

/**
 * Helper class for file operations.
 */
interface FileHelper {
    /**
     * Create resource and events files for the given session id.
     */
    fun createSessionFiles(sessionId: String)

    /**
     * Deletes the session directory for the given session id.
     */
    fun deleteSession(sessionId: String)

    /**
     * Returns true if the event log file is empty.
     */
    fun isEventLogEmpty(sessionId: String): Boolean

    /**
     * Returns the events json file for the given session id.
     */
    fun getEventsJsonFile(sessionId: String): File

    /**
     * Returns the resource file for the given session id.
     */
    fun getResourceFile(sessionId: String): File

    /**
     * Returns the event log file for the given session id.
     */
    fun getEventLogFile(sessionId: String): File
}

/**
 * Helper class for file operations.
 *
 * All files are stored in the app's internal storage. The directory structure is as follows:
 * - /measure/sessions/{session_id}/
 * - /measure/sessions/{session_id}/event_log
 * - /measure/sessions/{session_id}/events.json
 * - /measure/sessions/{session_id}/resource.json
 */
internal class FileHelperImpl(private val logger: Logger, private val context: Context) :
    FileHelper {
    private val rootDir: File by lazy { context.filesDir }

    override fun createSessionFiles(sessionId: String) {
        val dir = File(getSessionDirPath(sessionId))
        if (!dir.exists()) {
            dir.mkdirs()
        }
        try {
            getResourceFile(sessionId).createNewFile()
            getEventLogFile(sessionId).createNewFile()
            getEventsJsonFile(sessionId).createNewFile()
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Failed to create resource and events files", e)
            // remove the session dir to keep the state consistent
            if (dir.exists()) {
                dir.delete()
            }
        }
    }

    override fun deleteSession(sessionId: String) {
        getSessionDir(sessionId).deleteRecursively()
    }

    override fun getEventsJsonFile(sessionId: String): File {
        return File(getEventsJsonFilePath(sessionId))
    }

    override fun isEventLogEmpty(sessionId: String): Boolean {
        return getEventLogFile(sessionId).length() == 0L
    }

    override fun getResourceFile(sessionId: String): File {
        return File(getResourceFilePath(sessionId))
    }

    override fun getEventLogFile(sessionId: String): File {
        return File(getEventLogFilePath(sessionId))
    }

    private fun getSessionsDirPath(): String {
        return "${rootDir.path}/$MEASURE_DIR_NAME/$SESSIONS_DIR_NAME"
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

    private fun getResourceFilePath(sessionId: String): String {
        return "${getSessionDirPath(sessionId)}/$RESOURCE_FILE_NAME"
    }
}