package sh.measure.android.events

import sh.measure.android.Config
import sh.measure.android.SessionManager
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.appendAttributes
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.exporter.EventExporter
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.EventStore
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.ScreenshotHelper
import sh.measure.android.utils.iso8601Timestamp

/**
 * An interface for processing events. It is responsible for tracking events, processing them
 * by applying various attributes and transformations, and then eventually storing them or sending
 * them to the server.
 */
internal interface EventProcessor {
    /**
     * Tracks an event with the given data, timestamp and type.
     *
     * @param data The data to be tracked.
     * @param timestamp The timestamp of the event in milliseconds since epoch.
     * @param type The type of the event.
     */
    fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
    )

    /**
     * Tracks an event with the given data, timestamp and type for a different session than the
     * current one.
     *
     * @param data The data to be tracked.
     * @param timestamp The timestamp of the event in milliseconds since epoch.
     * @param type The type of the event.
     * @param sessionId The session id for the session to track this event for.
     */
    fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        sessionId: String,
    )

    /**
     * Tracks an event with the given data, timestamp, type, attributes and attachments.
     *
     * @param data The data to be tracked.
     * @param timestamp The timestamp of the event in milliseconds since epoch.
     * @param type The type of the event.
     * @param attributes The attributes to be attached to the event.
     * @param attachments The attachments to be attached to the event.
     */
    fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?> = mutableMapOf(),
        attachments: MutableList<Attachment> = mutableListOf(),
    )
}

internal class EventProcessorImpl(
    private val logger: Logger,
    private val executorService: MeasureExecutorService,
    private val eventStore: EventStore,
    private val idProvider: IdProvider,
    private val sessionManager: SessionManager,
    private val attributeProcessors: List<AttributeProcessor>,
    private val eventExporter: EventExporter,
    private val screenshotHelper: ScreenshotHelper,
    private val config: Config,
) : EventProcessor {

    override fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
    ) {
        track(data, timestamp, type, mutableMapOf(), mutableListOf(), null)
    }

    override fun <T> track(data: T, timestamp: Long, type: String, sessionId: String) {
        track(data, timestamp, type, mutableMapOf(), mutableListOf(), sessionId)
    }

    override fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: MutableList<Attachment>,
    ) {
        track(data, timestamp, type, attributes, attachments, null)
    }

    private fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: MutableList<Attachment>,
        sessionId: String?,
    ) {
        val threadName = Thread.currentThread().name

        fun createEvent(sessionId: String?): Event<T> {
            val id = idProvider.createId()
            val resolvedSessionId = sessionId ?: sessionManager.sessionId
            return Event(
                id = id,
                sessionId = resolvedSessionId,
                timestamp = timestamp.iso8601Timestamp(),
                type = type,
                data = data,
                attachments = attachments,
                attributes = attributes,
            )
        }

        fun applyAttributes(event: Event<T>) {
            event.appendAttribute(Attribute.THREAD_NAME, threadName)
            event.appendAttributes(attributeProcessors)
        }

        when (type) {
            // Exceptions and ANRs need to be processed synchronously to ensure that they are not
            // lost as the system is about to crash. They are also attempted to be exported
            // immediately to report them as soon as possible.
            EventType.ANR, EventType.EXCEPTION -> {
                val event = createEvent(sessionId)
                if (config.captureScreenshotForExceptions) {
                    addScreenshotAsAttachment(event)
                }
                applyAttributes(event)
                eventStore.store(event)
                eventExporter.export(event)
            }

            else -> {
                executorService.submit {
                    val event = createEvent(sessionId)
                    applyAttributes(event)
                    eventStore.store(event)
                }
            }
        }
        logger.log(LogLevel.Debug, "Event processed: $type")
    }

    private fun <T> addScreenshotAsAttachment(event: Event<T>) {
        val bytes = screenshotHelper.takeScreenshot()
        if (bytes != null) {
            event.addAttachment(
                Attachment(
                    name = "screenshot.png",
                    type = AttachmentType.SCREENSHOT,
                    bytes = bytes,
                ),
            )
        }
    }
}
