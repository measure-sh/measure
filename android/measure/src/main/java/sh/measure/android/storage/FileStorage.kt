package sh.measure.android.storage

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.File
import java.io.IOException

internal interface FileStorage {
    /**
     * Writes serialized event data to a file.
     *
     * @return The path of the file if the write was successful, otherwise null.
     */
    fun writeEventData(eventId: String, serializedData: String): String?

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
     * @param attachmentId The attachment id to use as the file name.
     */
    fun writeAttachment(attachmentId: String, bytes: ByteArray): String?

    /**
     * Deletes events and their attachments.
     *
     * @param eventIds The list of event ids to delete.
     * @param attachmentIds The list of attachment ids to delete.
     */
    fun deleteEventsIfExist(eventIds: List<String>, attachmentIds: List<String>)

    /**
     * Deletes an event and its attachments.
     *
     * @param eventId The event id to delete.
     * @param attachmentIds The list of attachment ids to delete.
     */
    fun deleteEventIfExist(eventId: String, attachmentIds: List<String>)

    /**
     * Returns all files in the measure directory.
     *
     * @param limit The maximum number of files to return.
     */
    fun getAllFiles(limit: Int = 100): List<File>

    /**
     * Deletes a list of files.
     */
    fun deleteFiles(files: List<File>)

    /**
     * Deletes a list of files using their path.
     */
    fun deleteFilePaths(paths: List<String>)

    /**
     * Writes a screenshot represented by the [bytes] with the given [name] and [extension].
     */
    fun writeTempBugReportScreenshot(
        name: String,
        extension: String,
        bytes: ByteArray,
        sessionId: String,
    ): String?

    /**
     * Returns the directory where bug report data is stored temporarily.
     */
    fun getBugReportDir(): File
}

private const val MEASURE_DIR = "measure"
private const val BUG_REPORTS_DIR = "bug_reports"

internal class FileStorageImpl(
    private val rootDir: String,
    private val logger: Logger,
) : FileStorage {

    override fun writeEventData(eventId: String, serializedData: String): String? {
        val file = createFile(eventId) ?: return null
        try {
            file.writeText(serializedData)
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error writing serialized event data to file", e)
            deleteFileIfExists(file)
            return null
        }
        return file.path
    }

    override fun writeAttachment(attachmentId: String, bytes: ByteArray): String? {
        val file = createFile(attachmentId) ?: return null
        return try {
            file.writeBytes(bytes)
            file.path
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error writing attachment to file", e)
            deleteFileIfExists(file)
            null
        }
    }

    override fun deleteEventIfExist(eventId: String, attachmentIds: List<String>) {
        deleteEventsIfExist(listOf(eventId), attachmentIds)
    }

    override fun getAllFiles(limit: Int): List<File> {
        val dir = File("$rootDir/$MEASURE_DIR")
        return dir.listFiles()?.take(limit) ?: emptyList()
    }

    override fun deleteFiles(files: List<File>) {
        files.forEach { file ->
            deleteFileIfExists(file)
        }
    }

    override fun deleteFilePaths(paths: List<String>) {
        deleteFiles(paths.mapNotNull { getFile(it) })
    }

    override fun writeTempBugReportScreenshot(
        name: String,
        extension: String,
        bytes: ByteArray,
        sessionId: String,
    ): String? {
        val file = createFile("$name.$extension", "$BUG_REPORTS_DIR/$sessionId")
        if (file != null) {
            file.writeBytes(bytes)
            return file.absolutePath
        }
        return null
    }

    override fun getBugReportDir(): File {
        return File("$rootDir/$MEASURE_DIR/$BUG_REPORTS_DIR")
    }

    override fun deleteEventsIfExist(eventIds: List<String>, attachmentIds: List<String>) {
        (eventIds + attachmentIds).forEach { id ->
            getFile("$rootDir/$MEASURE_DIR/$id")?.delete()
        }
    }

    override fun getFile(path: String): File? {
        val file = File(path)
        return when {
            file.exists() -> file
            else -> null
        }
    }

    private fun createFile(id: String, subdir: String = ""): File? {
        val dirPath = "$rootDir/$MEASURE_DIR/$subdir"
        val rootDir = File(dirPath)

        // Create directories if they don't exist
        try {
            if (!rootDir.exists()) {
                rootDir.mkdirs()
            }
        } catch (e: SecurityException) {
            logger.log(LogLevel.Error, "Unable to create file with id=$id", e)
            return null
        }

        // Create file with event id as file name
        val filePath = "$dirPath/$id"
        val file = File(filePath)
        try {
            if (!file.exists()) {
                file.createNewFile()
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error creating file with id=$id", e)
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
