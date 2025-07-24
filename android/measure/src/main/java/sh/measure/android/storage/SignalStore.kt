package sh.measure.android.storage

import kotlinx.serialization.encodeToString
import sh.measure.android.appexit.AppExit
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.okhttp.HttpData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.tracing.SpanData
import sh.measure.android.utils.IdProvider
import java.io.File
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean

internal interface SignalStore {
    fun <T> store(event: Event<T>)
    fun store(spanData: SpanData)
    fun flush()
}

/**
 * Signal store implementation that writes events and spans to the database and file storage.
 *
 * Events with large sizes are stored in the [FileStorage] and their paths are stored in the [Database].
 * While, smaller events are serialized and stored directly in the [Database].
 *
 * All event attachments are stored in the [FileStorage] and their paths are stored in the [Database].
 *
 * @see [PeriodicSignalStoreScheduler] all signals are buffered in memory. They are written to disk
 * either when the buffer is full or when the periodic scheduler triggers a [flush].
 */
internal class SignalStoreImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val database: Database,
    private val idProvider: IdProvider,
    private val configProvider: ConfigProvider,
) : SignalStore {
    private val eventQueue by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        LinkedBlockingQueue<EventEntity>(configProvider.maxInMemorySignalsQueueSize)
    }
    private val spanQueue by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        LinkedBlockingQueue<SpanEntity>(configProvider.maxInMemorySignalsQueueSize)
    }
    private val isFlushing = AtomicBoolean(false)

    override fun store(spanData: SpanData) {
        try {
            if (!spanData.isSampled) {
                // Do not store spans that are not sampled
                return
            }
            val spanEntity = spanData.toSpanEntity()
            val isQueueFull = !spanQueue.offer(spanEntity)
            if (isQueueFull) {
                database.insertSpan(spanEntity)
                flush()
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to store span ${spanData.name}", e)
        }
    }

    override fun <T> store(event: Event<T>) {
        try {
            val eventEntity = event.toEventEntity()
            if (eventEntity == null) {
                logger.log(
                    LogLevel.Debug,
                    "Failed to store event(${event.type}): unable to convert event to EventEntity",
                )
                return
            }
            val isCrashEvent =
                eventEntity.type == EventType.ANR || eventEntity.type == EventType.EXCEPTION

            when {
                isCrashEvent -> {
                    val success = database.insertEvent(eventEntity)
                    flush()
                    if (!success) {
                        handleEventInsertionFailure(eventEntity)
                    }
                }

                else -> {
                    val isQueueFull = !eventQueue.offer(eventEntity)
                    if (isQueueFull) {
                        val success = database.insertEvent(eventEntity)
                        flush()
                        if (!success) {
                            handleEventInsertionFailure(eventEntity)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to store event ${event.type}", e)
        }
    }

    override fun flush() {
        if (isFlushing.compareAndSet(false, true)) {
            try {
                val eventEntities = mutableListOf<EventEntity>()
                eventQueue.drainTo(eventEntities)
                val spanEntities = mutableListOf<SpanEntity>()
                spanQueue.drainTo(spanEntities)

                if (eventEntities.isEmpty() && spanEntities.isEmpty()) {
                    return
                }

                val success = database.insertSignals(eventEntities, spanEntities)
                if (!success) {
                    handleEventsInsertionFailure(eventEntities)
                }
            } finally {
                isFlushing.set(false)
            }
        }
    }

    private fun <T> Event<T>.shouldStoreEventDataInFile(): Boolean {
        return when (type) {
            EventType.EXCEPTION, EventType.ANR -> true
            EventType.HTTP -> {
                val httpEvent = data as? HttpData ?: return false
                return httpEvent.request_body != null || httpEvent.response_body != null
            }

            EventType.APP_EXIT -> {
                val appExit = data as? AppExit ?: return false
                return appExit.trace != null
            }

            else -> false
        }
    }

    /**
     * Serializes the event and writes the event attachments to disk if any.
     * Returns null if event attachment could not be written to file.
     */
    private fun <T> Event<T>.toEventEntity(): EventEntity? {
        val serializedAttributes = this.serializeAttributes()
        val serializedUserDefAttributes = this.serializeUserDefinedAttributes()
        val attachmentEntities = this.createAttachmentEntities()
        val serializedAttachments = serializeAttachmentEntities(attachmentEntities)
        val attachmentsSize = calculateAttachmentsSize(attachmentEntities)
        val serializedData = this.serializeDataToString()
        val storeEventDataInFile = this.shouldStoreEventDataInFile()
        val filePath = if (storeEventDataInFile) {
            // return from the function if writing to the file failed
            // this is to ensure that the event without data is never stored in the database
            fileStorage.writeEventData(this.id, serializedData) ?: return null
        } else {
            null
        }
        return createEventEntity(
            this,
            serializedAttributes,
            serializedUserDefAttributes,
            attachmentEntities,
            serializedAttachments,
            attachmentsSize,
            filePath,
            serializedData,
        )
    }

    private fun <T> createEventEntity(
        event: Event<T>,
        serializedAttributes: String?,
        serializedUserDefAttributes: String?,
        attachmentEntities: List<AttachmentEntity>?,
        serializedAttachments: String?,
        attachmentsSize: Long,
        filePath: String?,
        serializedData: String,
    ): EventEntity {
        if (filePath != null) {
            return EventEntity(
                id = event.id,
                sessionId = event.sessionId,
                timestamp = event.timestamp,
                type = event.type,
                attachmentEntities = attachmentEntities,
                serializedAttributes = serializedAttributes,
                attachmentsSize = attachmentsSize,
                serializedAttachments = serializedAttachments,
                filePath = filePath,
                serializedData = null,
                serializedUserDefAttributes = serializedUserDefAttributes,
                userTriggered = event.userTriggered,
            )
        } else {
            return EventEntity(
                id = event.id,
                sessionId = event.sessionId,
                timestamp = event.timestamp,
                type = event.type,
                attachmentEntities = attachmentEntities,
                serializedAttributes = serializedAttributes,
                attachmentsSize = attachmentsSize,
                serializedAttachments = serializedAttachments,
                filePath = null,
                serializedData = serializedData,
                serializedUserDefAttributes = serializedUserDefAttributes,
                userTriggered = event.userTriggered,
            )
        }
    }

    private fun handleEventsInsertionFailure(events: List<EventEntity>) {
        // TODO: handle event insertion failure for exception/ANR events
        // Event insertions typically fail due to cases we can't do much about.
        // However, given the way the SDK is setup, if the application crashes even before
        // the session can be inserted into the database, we'll miss out on capturing
        // the exception. This case needs to be handled.
        logger.log(
            LogLevel.Debug,
            "Failed to store events: event insertion failed, deleting related files",
        )
        events.forEach { event ->
            handleEventInsertionFailure(event)
        }
    }

    private fun handleEventInsertionFailure(event: EventEntity) {
        fileStorage.deleteEventIfExist(
            event.id,
            event.attachmentEntities?.map { it.id } ?: emptyList(),
        )
    }

    private fun serializeAttachmentEntities(attachmentEntities: List<AttachmentEntity>?): String? {
        if (attachmentEntities.isNullOrEmpty()) {
            return null
        }
        return jsonSerializer.encodeToString(attachmentEntities)
    }

    /**
     * Creates a list of [AttachmentEntity] from the attachments of the event.
     *
     * If the attachment has a path, it directly returns the [AttachmentEntity].
     * If the attachment has bytes, it writes the bytes to the file storage and returns the [AttachmentEntity]
     * with the path where the bytes were written to.
     */
    private fun <T> Event<T>.createAttachmentEntities(): List<AttachmentEntity>? {
        if (attachments.isEmpty()) {
            return null
        }
        val attachmentEntities = attachments.mapNotNull { attachment ->
            val id = idProvider.uuid()
            when {
                attachment.path != null -> {
                    AttachmentEntity(
                        id = id,
                        path = attachment.path,
                        name = attachment.name,
                        type = attachment.type,
                    )
                }

                attachment.bytes != null -> {
                    fileStorage.writeAttachment(id, attachment.bytes)?.let { path ->
                        AttachmentEntity(
                            id = id,
                            path = path,
                            name = attachment.name,
                            type = attachment.type,
                        )
                    }
                }

                else -> {
                    logger.log(
                        LogLevel.Debug,
                        "Failed to store attachment: neither path nor bytes are available",
                    )
                    null
                }
            }
        }
        return attachmentEntities
    }

    /**
     * Calculates the total size of all attachments, in bytes.
     */
    private fun calculateAttachmentsSize(attachmentEntities: List<AttachmentEntity>?): Long {
        fun fileSize(file: File): Long = try {
            if (file.exists()) file.length() else 0
        } catch (e: SecurityException) {
            logger.log(LogLevel.Debug, "Failed to calculate attachment size", e)
            0
        }
        return attachmentEntities?.sumOf {
            fileStorage.getFile(it.path)?.let { file -> fileSize(file) } ?: 0
        } ?: 0
    }
}
