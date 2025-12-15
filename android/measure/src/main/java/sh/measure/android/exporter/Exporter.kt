package sh.measure.android.exporter

import okio.IOException
import okio.source
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.BatchEntity
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import sh.measure.android.utils.DefaultSleeper
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.Randomizer
import sh.measure.android.utils.Sleeper
import sh.measure.android.utils.TimeProvider
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

internal interface Exporter {
    fun export()
    fun forceImmediateEventExport(eventId: String)
}

internal class ExporterImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val timeProvider: TimeProvider,
    private val randomizer: Randomizer,
    private val sleeper: Sleeper = DefaultSleeper(),
    private val fileStorage: FileStorage,
    private val database: Database,
    private val networkClient: NetworkClient,
    private val httpClient: HttpClient,
    private val configProvider: ConfigProvider,
    private val eventExportService: MeasureExecutorService,
    private val attachmentExportService: MeasureExecutorService,
) : Exporter {
    private val isExporting = AtomicBoolean(false)
    private val isCreatingBatch = AtomicBoolean(false)

    override fun export() {
        if (isExporting.get()) {
            logger.log(LogLevel.Debug, "Exporter: export is already in progress, skipping")
            return
        }
        try {
            exportEvents()
            exportAttachments()
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Exporter: failed to export", e)
        } finally {
            isExporting.set(false)
        }
    }

    override fun forceImmediateEventExport(eventId: String) {
        if (isCreatingBatch.get()) {
            return
        }
        eventExportService.submit {
            val batchId = idProvider.uuid()
            val eventPackets = database.getEventPackets(listOf(eventId))

            if (eventPackets.isEmpty()) {
                logger.log(LogLevel.Debug, "Exporter: event not found $eventId")
                return@submit
            }

            val spanPackets = emptyList<SpanPacket>()
            val result = networkClient.execute(batchId, eventPackets, spanPackets)
            handleEventsExportResponse(result, batchId, eventPackets, emptyList())
        }
    }

    private fun exportEvents() {
        eventExportService.submit {
            val batchId = createEventsBatch()
            if (batchId != null) {
                logger.log(LogLevel.Debug, "Exporter: created new batch $batchId")
            }

            while (true) {
                val batch = database.getBatches(1).firstOrNull()
                if (batch == null) {
                    return@submit
                }

                logger.log(LogLevel.Debug, "Exporter: exporting batch ${batch.batchId}")
                val events = database.getEventPackets(batch.eventIds)
                val spans = database.getSpanPackets(batch.spanIds)

                if (events.isEmpty() && spans.isEmpty()) {
                    // shouldn't happen, but just in case it does we'd like to know.
                    logger.log(
                        LogLevel.Debug,
                        "Exporter: invalid export request, no events or spans found for batch",
                    )
                    return@submit
                }

                val response = networkClient.execute(batch.batchId, events, spans)
                handleEventsExportResponse(response, batch.batchId, events, spans)
                if (response !is HttpResponse.Success) {
                    logger.log(LogLevel.Debug, "Exporter: stopping export loop on error")
                    return@submit
                } else {
                    sleeper.sleep(5000)
                }
            }
        }
    }

    private fun exportAttachments() {
        attachmentExportService.submit {
            while (true) {
                val attachments = database.getAttachmentsToUpload(5, emptyList())

                if (attachments.isEmpty()) {
                    logger.log(
                        LogLevel.Debug,
                        "Attachment export: no attachments to upload, exiting",
                    )
                    return@submit
                }

                attachments.forEach { attachment ->
                    val jitterMs = randomizer.nextInt(500)
                    val totalDelayMs = 500 + jitterMs
                    sleeper.sleep(totalDelayMs.toLong())

                    logger.log(
                        LogLevel.Debug,
                        "Attachment export: uploading ${attachment.id}"
                    )
                    val success = uploadAttachment(attachment)
                    if (!success) {
                        return@submit
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
            handleAttachmentUploadResponse(response, attachment)
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

    private fun createEventsBatch(): String? {
        try {
            isCreatingBatch.set(true)
            val events = database.getUnBatchedEvents(configProvider.maxEventsInBatch)
            val spansToQuery = maxOf(events.size - configProvider.maxEventsInBatch, 1)
            val spans = database.getUnBatchedSpans(spansToQuery)

            if (events.size + spans.size == 0) {
                logger.log(LogLevel.Debug, "Exporter: no events or spans to batch")
                return null
            }

            val batchId = idProvider.uuid()
            val result = database.insertBatch(
                BatchEntity(
                    batchId = batchId,
                    eventIds = events,
                    spanIds = spans,
                    createdAt = timeProvider.now(),
                )
            )
            return if (result) {
                batchId
            } else {
                logger.log(LogLevel.Debug, "Exporter: failed to create batch")
                null
            }

        } finally {
            isCreatingBatch.set(false)
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
                logger.log(LogLevel.Debug, "Exporter: successfully exported batch $batchId")
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

    private fun deleteBatch(
        events: List<EventPacket>,
        spans: List<SpanPacket>,
        batchId: String,
    ) {
        val eventIds = events.map { it.eventId }
        val spanIds = spans.map { it.spanId }
        database.deleteBatch(batchId, eventIds = eventIds, spanIds = spanIds)
        fileStorage.deleteEventsIfExist(eventIds)
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
}