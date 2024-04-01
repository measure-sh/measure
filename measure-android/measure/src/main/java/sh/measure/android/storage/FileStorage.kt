package sh.measure.android.storage

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okio.buffer
import okio.sink
import sh.measure.android.events.Event
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.File
import java.io.IOException

internal interface FileStorage {
    fun createExceptionFile(eventId: String): String?

    fun createAnrPath(eventId: String): String?

    fun writeException(path: String, event: Event<ExceptionData>)

    fun writeAnr(path: String, event: Event<ExceptionData>)

    fun getFile(path: String): File?
}

private const val EXCEPTION_DIR = "measure/exceptions"
private const val ANR_DIR = "measure/anr"

@OptIn(ExperimentalSerializationApi::class)
internal class FileStorageImpl(
    private val rootDir: String,
    private val logger: Logger,
) : FileStorage {

    override fun createExceptionFile(eventId: String): String? {
        val exceptionDirPath = "$rootDir/$EXCEPTION_DIR"
        val rootDir = File(exceptionDirPath)

        // Create directories if they don't exist
        if (!rootDir.exists()) {
            try {
                rootDir.mkdirs()
            } catch (e: SecurityException) {
                logger.log(
                    LogLevel.Error,
                    "Unable to create exception file for eventId=$eventId",
                    e
                )
                return null
            }
        }

        // Create file with event id as file name
        val filePath = "$exceptionDirPath/$eventId"
        val file = File(filePath)
        try {
            file.createNewFile()
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error creating exception file for eventId=$eventId", e)
            return null
        }

        return filePath
    }

    override fun createAnrPath(eventId: String): String? {
        val anrDirPath = "$rootDir/$ANR_DIR"
        val rootDir = File(anrDirPath)

        // Create directories if they don't exist
        if (!rootDir.exists()) {
            try {
                rootDir.mkdirs()
            } catch (e: SecurityException) {
                logger.log(LogLevel.Error, "Unable to create ANR file for eventId=$eventId", e)
                return null
            }
        }

        // Create file with event id as file name
        val filePath = "$anrDirPath/$eventId"
        val file = File(filePath)
        try {
            file.createNewFile()
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error creating ANR file for eventId=$eventId", e)
            return null
        }

        return filePath
    }

    override fun writeException(path: String, event: Event<ExceptionData>) {
        val file = File(path)
        if (!file.exists()) {
            file.createNewFile()
        }
        try {
            Json.encodeToStream(event.data, file.sink().buffer().outputStream())
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error writing exception to file", e)
        } catch (se: SerializationException) {
            logger.log(LogLevel.Error, "Error writing exception to file", se)
        }
        logger.log(LogLevel.Debug, "FileStorage: Exception written to file")
    }

    override fun writeAnr(path: String, event: Event<ExceptionData>) {
        val file = File(path)
        if (!file.exists()) {
            file.createNewFile()
        }
        try {
            Json.encodeToStream(event.data, File(path).sink().buffer().outputStream())
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error writing ANR to file", e)
        } catch (se: SerializationException) {
            logger.log(LogLevel.Error, "Error writing ANR to file", se)
        }
        logger.log(LogLevel.Debug, "FileStorage: ANR written to file")
    }

    override fun getFile(path: String): File? {
        val file = File(path)
        return when {
            file.exists() -> file
            else -> null
        }
    }
}