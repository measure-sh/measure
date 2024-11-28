package sh.measure.android.events

import sh.measure.android.SessionManager
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.UserDefinedAttribute
import sh.measure.android.attributes.appendAttributes
import sh.measure.android.config.ConfigProvider
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.exporter.ExceptionExporter
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.screenshot.ScreenshotCollector
import sh.measure.android.storage.EventStore
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.iso8601Timestamp
import java.util.concurrent.RejectedExecutionException

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

    /**
     * Tracks a user defined event with the given data, timestamp and type.
     */
    fun <T> trackUserTriggered(data: T, timestamp: Long, type: String)

    /**
     * Tracks a crash event with the given exception data, timestamp, type, attributes and attachments.
     * This method is used to track ANRs and unhandled exceptions. Such events are processed
     * synchronously and are attempted to be exported immediately.
     */
    fun trackCrash(
        data: ExceptionData,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?> = mutableMapOf(),
        attachments: MutableList<Attachment> = mutableListOf(),
    )
}

internal class EventProcessorImpl(
    private val logger: Logger,
    private val ioExecutor: MeasureExecutorService,
    private val eventStore: EventStore,
    private val idProvider: IdProvider,
    private val sessionManager: SessionManager,
    private val attributeProcessors: List<AttributeProcessor>,
    private val userDefinedAttribute: UserDefinedAttribute,
    private val eventTransformer: EventTransformer,
    private val exceptionExporter: ExceptionExporter,
    private val screenshotCollector: ScreenshotCollector,
    private val configProvider: ConfigProvider,
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

    override fun <T> trackUserTriggered(data: T, timestamp: Long, type: String) {
        track(
            data,
            timestamp,
            type,
            mutableMapOf(),
            mutableListOf(),
            sessionId = null,
            userTriggered = true,
        )
    }

    override fun trackCrash(
        data: ExceptionData,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: MutableList<Attachment>,
    ) {
        val threadName = Thread.currentThread().name
        val event = createEvent(
            data = data,
            timestamp = timestamp,
            type = type,
            attachments = attachments,
            attributes = attributes,
            userTriggered = false,
        )
        if (configProvider.trackScreenshotOnCrash) {
            addScreenshotAsAttachment(event)
        }
        applyAttributes(event, threadName)
        eventTransformer.transform(event)?.let {
            eventStore.store(event)
            onEventTracked(event)
            sessionManager.markCrashedSession(event.sessionId)
            exceptionExporter.export(event.sessionId)
            logger.log(LogLevel.Debug, "Event processed: $type, ${event.sessionId}")
        } ?: logger.log(LogLevel.Debug, "Event dropped: $type")
    }

    private fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: MutableList<Attachment>,
        sessionId: String?,
        userTriggered: Boolean = false,
    ) {
        val threadName = Thread.currentThread().name
        try {
            ioExecutor.submit {
                InternalTrace.trace(
                    label = { "msr-track-event" },
                    block = {
                        val event = createEvent(
                            data = data,
                            timestamp = timestamp,
                            type = type,
                            attachments = attachments,
                            attributes = attributes,
                            userTriggered = userTriggered,
                            sessionId = sessionId,
                        )
                        applyAttributes(event, threadName)
                        val transformedEvent = InternalTrace.trace(
                            label = { "msr-transform-event" },
                            block = { eventTransformer.transform(event) },
                        )

                        if (transformedEvent != null) {
                            InternalTrace.trace(label = { "msr-store-event" }, block = {
                                eventStore.store(event)
                                onEventTracked(event)
                                logger.log(
                                    LogLevel.Debug,
                                    "Event processed: ${event.type}:${event.id}",
                                )
                            })
                        } else {
                            logger.log(LogLevel.Debug, "Event dropped: $type")
                        }
                    },
                )
            }
        } catch (e: RejectedExecutionException) {
            logger.log(
                LogLevel.Error,
                "Failed to submit event processing task to executor",
                e,
            )
        }
    }

    private fun <T> onEventTracked(event: Event<T>) {
        sessionManager.onEventTracked(event)
    }

    private fun <T> createEvent(
        timestamp: Long,
        type: String,
        data: T,
        attachments: MutableList<Attachment>,
        attributes: MutableMap<String, Any?>,
        userTriggered: Boolean,
        sessionId: String? = null,
    ): Event<T> {
        val id = idProvider.createId()
        val resolvedSessionId = sessionId ?: sessionManager.getSessionId()
        return Event(
            id = id,
            sessionId = resolvedSessionId,
            timestamp = timestamp.iso8601Timestamp(),
            type = type,
            data = data,
            attachments = attachments,
            attributes = attributes,
            userTriggered = userTriggered,
            userDefinedAttributes = userDefinedAttribute.getAll(),
        )
    }

    private fun <T> applyAttributes(event: Event<T>, threadName: String) {
        InternalTrace.trace(label = { "msr-apply-attributes" }, block = {
            event.appendAttribute(Attribute.THREAD_NAME, threadName)
            event.appendAttributes(attributeProcessors)
        })
    }

    private fun <T> addScreenshotAsAttachment(event: Event<T>) {
        InternalTrace.trace(label = { "msr-take-screenshot" }, block = {
            val screenshot = screenshotCollector.takeScreenshot()
            if (screenshot != null) {
                event.addAttachment(
                    Attachment(
                        name = "screenshot.${screenshot.extension}",
                        type = AttachmentType.SCREENSHOT,
                        bytes = screenshot.data,
                    ),
                )
            }
        })
    }
}
