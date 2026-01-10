package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import okio.IOException
import okio.source
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import sh.measure.android.utils.DefaultSleeper
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.Sleeper
import sh.measure.android.utils.TimeProvider
import java.io.File
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

internal interface Exporter {
    fun export()
}

internal class ExporterImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val timeProvider: TimeProvider,
    private val sleeper: Sleeper = DefaultSleeper(),
    private val fileStorage: FileStorage,
    private val database: Database,
    private val networkClient: NetworkClient,
    private val httpClient: HttpClient,
    private val configProvider: ConfigProvider,
    private val eventExportService: MeasureExecutorService,
    private val attachmentExportService: MeasureExecutorService,
) : Exporter {
    @VisibleForTesting
    internal val isExporting = AtomicBoolean(false)

    override fun export() {
        if (isExporting.compareAndSet(false, true)) {
            try {
                exportEvents()
                exportAttachments()
            } catch (e: Exception) {
                logger.log(LogLevel.Error, "Exporter: failed to export", e)
            } finally {
                isExporting.set(false)
            }
        } else {
            logger.log(LogLevel.Debug, "Exporter: export already in progress, skipping")
        }
    }

    private fun exportEvents() {
        try {
            eventExportService.submit {
                try {
                    // First export existing batches
                    val existingBatches = database.getBatchIds()
                    if (existingBatches.isNotEmpty()) {
                        logger.log(
                            LogLevel.Debug,
                            "Exporter: found ${existingBatches.size} existing batches, exporting",
                        )

                        val success = exportBatches(existingBatches)
                        if (!success) {
                            // abort if no batches found or export failed
                            return@submit
                        }
                    }

                    // Then create new batches and export
                    val batchesCreatedCount = database.batchSessions(
                        idProvider,
                        timeProvider,
                        configProvider.maxEventsInBatch,
                        1000,
                    )
                    if (batchesCreatedCount > 0) {
                        logger.log(
                            LogLevel.Debug,
                            "Exporter: created $batchesCreatedCount new batches, exporting",
                        )
                        val newBatches = database.getBatchIds()
                        if (newBatches.isNotEmpty()) {
                            exportBatches(newBatches)
                        }
                    } else {
                        logger.log(LogLevel.Debug, "Exporter: no batches to export")
                    }
                } catch (e: Exception) {
                    logger.log(LogLevel.Error, "Exporter: failed to export", e)
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Exporter: failed to submit export task", e)
        }
    }

    private fun exportBatches(batches: List<String>): Boolean {
        var success = true
        batches.forEachIndexed { index, batch ->
            val batch = database.getBatch(batch)

            if (!exportBatch(batch)) {
                success = false
                return@forEachIndexed
            }

            if (index < batches.size - 1) {
                sleeper.sleep(configProvider.batchExportIntervalMs)
            }
        }
        return success
    }

    private fun exportBatch(batch: Batch): Boolean {
        if (batch.eventIds.isEmpty() && batch.spanIds.isEmpty()) {
            logger.log(
                LogLevel.Error,
                "Exporter: invalid batch, no events or spans found for batch ${batch.batchId}",
            )
            database.deleteBatch(batch.batchId, emptyList(), emptyList())
            return false
        }

        val events = database.getEventPackets(batch.eventIds)
        val spans = database.getSpanPackets(batch.spanIds)

        if (events.isEmpty() && spans.isEmpty()) {
            logger.log(
                LogLevel.Error,
                "Exporter: invalid export request, no events or spans found for batch",
            )
            database.deleteBatch(batch.batchId, emptyList(), emptyList())
            return false
        }

        logger.log(
            LogLevel.Debug,
            "Exporter: exporting batch ${batch.batchId} with ${events.size} events and ${spans.size} spans",
        )

        // Remove events that have an invalid file path
        val validEvents = events.filter {
            if (it.serializedDataFilePath != null) {
                val isValid = fileStorage.validateFile(it.serializedDataFilePath)
                if (!isValid) {
                    logger.log(
                        LogLevel.Error,
                        "Exporter: failed to read event data, discarding event ${it.eventId}",
                    )
                }
                isValid
            } else {
                true
            }
        }

        val response = networkClient.execute(batch.batchId, validEvents, spans)
        handleEventsExportResponse(response, batch.batchId, validEvents, spans)

        return response is HttpResponse.Success
    }

    private fun exportAttachments() {
        attachmentExportService.submit {
            while (true) {
                val attachments = database.getAttachmentsToUpload(5)

                if (attachments.isEmpty()) {
                    logger.log(
                        LogLevel.Debug,
                        "Exporter: no attachments to upload, exiting",
                    )
                    return@submit
                }

                attachments.forEachIndexed { index, attachment ->
                    logger.log(
                        LogLevel.Debug,
                        "Exporter: attachment uploading ${attachment.id}",
                    )
                    val success = uploadAttachment(attachment)
                    if (!success) {
                        return@submit
                    }

                    if (index < attachments.size - 1) {
                        sleeper.sleep(configProvider.attachmentExportIntervalMs)
                    }
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
                    "Exporter: attachment failed to read attachment file ${attachment.id}, this file will be deleted",
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
            handleAttachmentUploadResponse(response, attachment)
        } catch (_: IOException) {
            // do nothing
            false
        } catch (e: Exception) {
            logger.log(
                LogLevel.Error,
                "Exporter: attachment failed to upload ${attachment.name} (${attachment.id})",
                e,
            )
            false
        }
    }

    private fun parseEventsResponse(body: String?): EventsResponse? {
        if (body.isNullOrEmpty()) {
            return null
        }
        return try {
            jsonSerializer.decodeFromString(
                EventsResponse.serializer(),
                body,
            )
        } catch (e: Exception) {
            logger.log(LogLevel.Debug, "Exporter: failed to parse /events response", e)
            null
        }
    }

    private fun handleEventsExportResponse(
        response: HttpResponse,
        batchId: String,
        events: List<EventPacket>,
        spans: List<SpanPacket>,
    ) {
        when (response) {
            is HttpResponse.Success -> {
                logger.log(
                    LogLevel.Debug,
                    "Exporter: successfully exported batch $batchId with ${events.size} events and ${spans.size} spans",
                )
                val eventsResponse = parseEventsResponse(response.body)
                val attachments = eventsResponse?.attachments
                if (eventsResponse != null && attachments != null && attachments.isNotEmpty()) {
                    val success =
                        database.updateAttachmentUrls(attachments)
                    if (!success) {
                        logger.log(
                            LogLevel.Debug,
                            "Exporter: failed to update attachment table with signed URLs",
                        )
                        // Delete attachments as there is no way to retry as of now
                        database.deleteAttachments(eventsResponse.attachments.map { it.id })
                    } else {
                        logger.log(
                            LogLevel.Debug,
                            "Exporter: successfully updated attachment table with signed URLs",
                        )
                        // Trigger a attachment export
                        // so that the freshly attachments
                        // with freshly received signed URLs
                        // are uploaded.
                        exportAttachments()
                    }
                }
                deleteBatch(events, spans, batchId)
            }

            is HttpResponse.Error.ClientError -> {
                deleteBatch(events, spans, batchId)
                logger.log(
                    LogLevel.Debug,
                    "Exporter: failed to export batch $batchId, response code: ${response.code}",
                )
            }

            is HttpResponse.Error.ServerError -> {
                logger.log(
                    LogLevel.Debug,
                    "Exporter: failed to export batch $batchId, response code: ${response.code}",
                )
            }

            is HttpResponse.Error.UnknownError -> {
                logger.log(
                    LogLevel.Debug,
                    "Exporter: failed to export batch $batchId",
                    response.exception,
                )
            }

            else -> {
                // No-op
            }
        }
    }

    private fun handleAttachmentUploadResponse(
        response: HttpResponse,
        attachment: AttachmentPacket,
    ): Boolean = when (response) {
        is HttpResponse.Success -> {
            logger.log(
                LogLevel.Debug,
                "Exporter: attachment successfully uploaded and deleted ${attachment.id}",
            )
            fileStorage.deleteFilePaths(listOf(attachment.path))
            database.deleteAttachment(attachment.id)
            true
        }

        is HttpResponse.Error.ClientError -> {
            logger.log(
                LogLevel.Error,
                "Exporter: attachment upload failed for (${attachment.id}), status code: ${response.code}, deleting attachment",
            )
            fileStorage.deleteFilePaths(listOf(attachment.path))
            database.deleteAttachment(attachment.id)
            false
        }

        is HttpResponse.Error.ServerError -> {
            logger.log(
                LogLevel.Debug,
                "Exporter: attachment upload failed for (${attachment.id}, status code: ${response.code})",
            )
            false
        }

        is HttpResponse.Error.UnknownError -> {
            logger.log(
                LogLevel.Debug,
                "Exporter: attachment upload failed for (${attachment.id})",
                response.exception,
            )
            false
        }

        else -> {
            logger.log(
                LogLevel.Debug,
                "Exporter: attachment upload failed for (${attachment.id})",
            )
            false
        }
    }

    private fun deleteBatch(
        events: List<EventPacket>,
        spans: List<SpanPacket>,
        batchId: String,
    ) {
        val eventIds = events.map { it.eventId }
        val spanIds = spans.map { it.spanId }
        database.deleteBatch(batchId, eventIds = eventIds, spanIds = spanIds)
        fileStorage.deleteEventsIfExist(eventIds)
        fileStorage.deleteAttachmentsIfExist(eventIds)
    }

    private fun validateFile(file: File, attachment: AttachmentPacket): Boolean {
        if (!file.exists() || !file.canRead()) {
            logger.log(
                LogLevel.Error,
                "Exporter: attachment file not found or not readable: ${attachment.path}",
            )
            return false
        }
        return true
    }
}
