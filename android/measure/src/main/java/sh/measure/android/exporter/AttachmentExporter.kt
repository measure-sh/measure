package sh.measure.android.exporter

import okio.IOException
import okio.source
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import sh.measure.android.utils.DefaultSleeper
import sh.measure.android.utils.Randomizer
import sh.measure.android.utils.Sleeper
import java.io.File
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Manages the lifecycle and export of attachment uploads.
 */
internal interface AttachmentExporter {
    /**
     * Starts the attachment export process.
     */
    fun register()

    /**
     * Stops the attachment export process and cancels any in-progress operations.
     */
    fun unregister()

    /**
     * Trigger when new attachments are available for export.
     */
    fun onNewAttachmentsAvailable()
}

internal class DefaultAttachmentExporter(
    private val logger: Logger,
    private val executorService: MeasureExecutorService,
    private val database: Database,
    private val randomizer: Randomizer,
    private val fileStorage: FileStorage,
    private val httpClient: HttpClient,
    private val sleeper: Sleeper = DefaultSleeper(),
) :
    AttachmentExporter {
    private val isRegistered = AtomicBoolean(false)
    private val isExportInProgress = AtomicBoolean(false)
    private var exportFuture: Future<*>? = null

    private companion object {
        private const val BASE_DELAY_MS = 500
        private const val JITTER_MAX_MS = 500
        private const val BATCH_SIZE = 10
    }

    override fun register() {
        if (isRegistered.compareAndSet(false, true)) {
            logger.log(LogLevel.Debug, "Attachment export: registered")
            startExport()
        }
    }

    override fun unregister() {
        if (isRegistered.compareAndSet(true, false)) {
            logger.log(LogLevel.Debug, "Attachment export: unregistered")
        }
    }

    override fun onNewAttachmentsAvailable() {
        startExport()
    }

    private fun startExport() {
        if (!isRegistered.get()) {
            return
        }

        if (!isExportInProgress.compareAndSet(false, true)) {
            return
        }

        exportFuture = executorService.submit {
            try {
                logger.log(LogLevel.Debug, "Attachment export: starting export")
                runUploadLoop()
            } catch (_: InterruptedException) {
                logger.log(LogLevel.Debug, "Attachment export: canceling attachment upload")
            } catch (e: Exception) {
                logger.log(LogLevel.Error, "Attachment export: failed to export attachments", e)
            } finally {
                isExportInProgress.set(false)
            }
        }
    }

    private fun runUploadLoop() {
        while (true) {
            val attachments = database.getAttachmentsToUpload(BATCH_SIZE, emptyList())

            if (attachments.isEmpty()) {
                logger.log(
                    LogLevel.Debug,
                    "Attachment export: no attachments to upload, exiting",
                )
                return
            }

            attachments.forEach { attachment ->
                val jitterMs = randomizer.nextInt(JITTER_MAX_MS)
                val totalDelayMs = BASE_DELAY_MS + jitterMs
                sleeper.sleep(totalDelayMs.toLong())

                logger.log(LogLevel.Debug, "Attachment export: uploading ${attachment.id}")
                val success = uploadAttachment(attachment)
                if (!success) {
                    return
                }
            }
        }
    }

    private fun uploadAttachment(attachment: AttachmentPacket): Boolean {
        return try {
            val file = File(attachment.path)
            if (!validateFile(file, attachment)) {
                logger.log(
                    LogLevel.Error,
                    "Attachment export: failed to read attachment file ${attachment.id}, this file will be deleted",
                )
                fileStorage.deleteFiles(listOf(file))
                database.deleteAttachment(attachment.id)
                return false
            }
            val response = httpClient.uploadFile(
                url = attachment.url,
                contentType = attachment.contentType,
                headers = attachment.headers,
                fileSize = file.length(),
            ) { sink ->
                sink.writeAll(file.source())
            }
            handleResponse(response, attachment)
        } catch (_: IOException) {
            // do nothing
            false
        } catch (e: Exception) {
            logger.log(
                LogLevel.Error,
                "Attachment export: failed to upload ${attachment.name} (${attachment.id})",
                e,
            )
            false
        }
    }

    private fun validateFile(file: File, attachment: AttachmentPacket): Boolean {
        if (!file.exists() || !file.canRead()) {
            logger.log(
                LogLevel.Error,
                "Attachment export: file not found or not readable: ${attachment.path}",
            )
            return false
        }
        return true
    }

    private fun handleResponse(
        response: HttpResponse,
        attachment: AttachmentPacket,
    ): Boolean {
        return when (response) {
            is HttpResponse.Success -> {
                logger.log(
                    LogLevel.Debug,
                    "Attachment export: successfully uploaded and deleted ${attachment.id}",
                )
                fileStorage.deleteFilePaths(listOf(attachment.path))
                database.deleteAttachment(attachment.id)
                true
            }

            is HttpResponse.Error.ClientError -> {
                logger.log(
                    LogLevel.Error,
                    "Attachment export: upload failed for (${attachment.id}), status code: ${response.code}, deleting attachment",
                )
                fileStorage.deleteFilePaths(listOf(attachment.path))
                database.deleteAttachment(attachment.id)
                false
            }

            is HttpResponse.Error.ServerError -> {
                logger.log(
                    LogLevel.Debug,
                    "Attachment export: upload failed for (${attachment.id}, status code: ${response.code})",
                )
                false
            }

            is HttpResponse.Error.UnknownError -> {
                logger.log(
                    LogLevel.Debug,
                    "Attachment export: upload failed for (${attachment.id})",
                    response.exception,
                )
                false
            }

            else -> {
                logger.log(
                    LogLevel.Debug,
                    "Attachment export: upload failed for (${attachment.id})",
                )
                false
            }
        }
    }
}
