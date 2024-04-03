package sh.measure.android.storage

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import sh.measure.android.events.Event
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.File
import java.io.IOException

internal interface FileStorage {

    /**
     * Creates a file for an attachment with the given name.
     *
     * @param attachmentName The name of the attachment.
     * @return The path of the file if the creation was successful, otherwise null.
     */
    fun createAttachmentFile(attachmentName: String): String?

    /**
     * Writes exception data to a file, with the event id as the file name.
     *
     * @param id The event id to use as the file name.
     * @param event The event to write to the file.
     * @return The path of the file if the write was successful, otherwise null.
     */
    fun writeException(id: String, event: Event<ExceptionData>): String?

    /**
     * Writes ANR data to a file, with the event id as the file name.
     *
     * @param id The event id to use as the file name.
     * @param event The event to write to the file.
     * @return The path of the file if the write was successful, otherwise null.
     */
    fun writeAnr(id: String, event: Event<ExceptionData>): String?

    /**
     * Gets a file from the given path.
     *
     * @param path The path of the file to get.
     * @return The file if it exists, otherwise null.
     */
    fun getFile(path: String): File?
}

private const val EXCEPTION_DIR = "measure/exceptions"
private const val ANR_DIR = "measure/anr"
private const val ATTACHMENTS_DIR = "measure/attachments"

@OptIn(ExperimentalSerializationApi::class)
internal class FileStorageImpl(
    private val rootDir: String,
    private val logger: Logger,
) : FileStorage {
    override fun createAttachmentFile(attachmentName: String): String {
        val dirPath = "$rootDir/$ATTACHMENTS_DIR"
        val rootDir = File(dirPath)

        // Create directories if they don't exist
        try {
            if (!rootDir.exists()) {
                rootDir.mkdirs()
            }
        } catch (e: SecurityException) {
            logger.log(LogLevel.Error, "Unable to create attachments directory", e)
        }

        // Create file with attachment name as file name
        val filePath = "$dirPath/$attachmentName"
        val file = File(filePath)
        try {
            if (!file.exists()) {
                file.createNewFile()
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error creating attachment $attachmentName", e)
        }
        return file.path
    }

    override fun writeException(id: String, event: Event<ExceptionData>): String? {
        val file = createFile(id, EXCEPTION_DIR) ?: return null
        return writeFile(file, event)
    }

    override fun writeAnr(id: String, event: Event<ExceptionData>): String? {
        val file = createFile(id, ANR_DIR) ?: return null
        return writeFile(file, event)
    }

    override fun getFile(path: String): File? {
        val file = File(path)
        return when {
            file.exists() -> file
            else -> null
        }
    }

    private fun createFile(eventId: String, directory: String): File? {
        val dirPath = "$rootDir/$directory"
        val rootDir = File(dirPath)

        // Create directories if they don't exist
        try {
            if (!rootDir.exists()) {
                rootDir.mkdirs()
            }
        } catch (e: SecurityException) {
            logger.log(LogLevel.Error, "Unable to create file for eventId=$eventId", e)
            return null
        }

        // Create file with event id as file name
        val filePath = "$dirPath/$eventId"
        val file = File(filePath)
        try {
            if (!file.exists()) {
                file.createNewFile()
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error creating file for eventId=$eventId", e)
            return null
        }

        return file
    }

    private fun writeFile(file: File, event: Event<ExceptionData>): String? {
        try {
            val stream = file.outputStream()
            Json.encodeToStream(event.data, stream)
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error writing to file", e)
            deleteFileIfExists(file)
            return null
        } catch (se: SerializationException) {
            logger.log(LogLevel.Error, "Error writing to file", se)
            deleteFileIfExists(file)
            return null
        }
        return file.path
    }

    private fun deleteFileIfExists(file: File) {
        if (file.exists()) {
            file.delete()
        }
    }
}