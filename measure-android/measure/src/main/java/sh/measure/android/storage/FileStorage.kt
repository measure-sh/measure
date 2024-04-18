package sh.measure.android.storage

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.File
import java.io.IOException

internal interface FileStorage {
    /**
     * Writes exception data to a file, with the event id as the file name.
     *
     * @return The path of the file if the write was successful, otherwise null.
     */
    fun writeException(eventId: String, serializedData: String): String?

    /**
     * Writes ANR data to a file, with the event id as the file name.
     *
     * @param eventId The event id to use as the file name.
     * @return The path of the file if the write was successful, otherwise null.
     */
    fun writeAnr(eventId: String, serializedData: String): String?

    /**
     * Gets a file from the given path.
     *
     * @param path The path of the file to get.
     * @return The file if it exists, otherwise null.
     */
    fun getFile(path: String): File?

    /**
     * Writes an attachment to a file, with the attachment id as the file name.
     *
     * @param id The attachment id to use as the file name.
     */
    fun writeAttachment(id: String, bytes: ByteArray): String?
}

private const val EXCEPTION_DIR = "measure/exceptions"
private const val ANR_DIR = "measure/anr"
private const val ATTACHMENTS_DIR = "measure/attachments"

internal class FileStorageImpl(
    private val rootDir: String,
    private val logger: Logger,
) : FileStorage {

    override fun writeException(eventId: String, serializedData: String): String? {
        val file = createFile(eventId, EXCEPTION_DIR) ?: return null
        file.writeText(serializedData)
        return file.path
    }

    override fun writeAnr(eventId: String, serializedData: String): String? {
        val file = createFile(eventId, ANR_DIR) ?: return null
        file.writeText(serializedData)
        return file.path
    }

    override fun getFile(path: String): File? {
        val file = File(path)
        return when {
            file.exists() -> file
            else -> null
        }
    }

    override fun writeAttachment(id: String, bytes: ByteArray): String? {
        val file = createFile(id, ATTACHMENTS_DIR) ?: return null
        return try {
            file.writeBytes(bytes)
            file.path
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error writing attachment to file", e)
            deleteFileIfExists(file)
            null
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

    private fun deleteFileIfExists(file: File) {
        if (file.exists()) {
            file.delete()
        }
    }
}
