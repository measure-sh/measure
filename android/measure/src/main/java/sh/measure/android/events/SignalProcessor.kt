package sh.measure.android.events

import sh.measure.android.SessionManager
import sh.measure.android.appexit.AppExit
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.appendAttributes
import sh.measure.android.config.ConfigProvider
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.exporter.ExceptionExporter
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.screenshot.ScreenshotCollector
import sh.measure.android.storage.SignalStore
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.tracing.SpanData
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.iso8601Timestamp
import java.util.concurrent.RejectedExecutionException

/**
 * An interface for processing event and span signals. It is responsible for tracking signals processing them
 * by applying various attributes and transformations, and then eventually storing them or sending
 * them to the server.
 */
internal interface SignalProcessor {
    /**
     * Tracks an event with the given data, timestamp and type.
     *
     * @param data The data to be tracked.
     * @param timestamp The timestamp of the event in milliseconds since epoch.
     * @param type The type of the event.
     * @param attributes Optional attributes to be attached to the event.
     * @param attachments Optional attachments to be attached to the event.
     * @param threadName Optional thread name for the event.
     * @param sessionId Optional session id for tracking events in a different session.
     * @param userTriggered Optional flag indicating if this is a user-triggered event.
     */
    fun <T> track(
        data: T,
        timestamp: Long,
        type: EventType,
        attributes: MutableMap<String, Any?> = mutableMapOf(),
        userDefinedAttributes: Map<String, AttributeValue> = mapOf(),
        attachments: MutableList<Attachment> = mutableListOf(),
        threadName: String? = null,
        sessionId: String? = null,
        userTriggered: Boolean = false,
    )

    /**
     * App exit events can be triggered for an older session. This method is used to track app exit
     * events for a specific session with the attributes provided.
     */
    fun trackAppExit(
        data: AppExit,
        timestamp: Long,
        type: EventType,
        threadName: String,
        sessionId: String,
        appVersion: String?,
        appBuild: String?,
    )

    /**
     * Tracks a user defined event with the given data, timestamp and type.
     */
    fun <T> trackUserTriggered(
        data: T,
        timestamp: Long,
        type: EventType,
        attachments: MutableList<Attachment> = mutableListOf(),
        userDefinedAttributes: Map<String, AttributeValue> = mapOf(),
    )

    /**
     * Tracks a crash event with the given exception data, timestamp, type, attributes and attachments.
     * This method is used to track ANRs and unhandled exceptions. Such events are processed
     * synchronously and are attempted to be exported immediately.
     */
    fun trackCrash(
        data: ExceptionData,
        timestamp: Long,
        type: EventType,
        attributes: MutableMap<String, Any?> = mutableMapOf(),
        userDefinedAttributes: Map<String, AttributeValue> = mapOf(),
        attachments: MutableList<Attachment> = mutableListOf(),
    )

    fun trackSpan(spanData: SpanData)
}

internal class SignalProcessorImpl(
    private val logger: Logger,
    private val ioExecutor: MeasureExecutorService,
    private val signalStore: SignalStore,
    private val idProvider: IdProvider,
    private val sessionManager: SessionManager,
    private val attributeProcessors: List<AttributeProcessor>,
    private val eventTransformer: EventTransformer,
    private val exceptionExporter: ExceptionExporter,
    private val screenshotCollector: ScreenshotCollector,
    private val configProvider: ConfigProvider,
) : SignalProcessor {

    override fun <T> trackUserTriggered(
        data: T,
        timestamp: Long,
        type: EventType,
        attachments: MutableList<Attachment>,
        userDefinedAttributes: Map<String, AttributeValue>,
    ) {
        track(
            data = data,
            timestamp = timestamp,
            type = type,
            attributes = mutableMapOf(),
            userDefinedAttributes = userDefinedAttributes,
            attachments = attachments,
            sessionId = null,
            threadName = null,
            userTriggered = true,
        )
    }

    override fun <T> track(
        data: T,
        timestamp: Long,
        type: EventType,
        attributes: MutableMap<String, Any?>,
        userDefinedAttributes: Map<String, AttributeValue>,
        attachments: MutableList<Attachment>,
        threadName: String?,
        sessionId: String?,
        userTriggered: Boolean,
    ) {
        val resolvedThreadName = threadName ?: Thread.currentThread().name
        try {
            ioExecutor.submit {
                InternalTrace.trace(
                    label = { "msr-trackEvent" },
                    block = {
                        val event = createEvent(
                            data = data,
                            timestamp = timestamp,
                            type = type,
                            attachments = attachments,
                            attributes = attributes,
                            userTriggered = userTriggered,
                            userDefinedAttributes = userDefinedAttributes,
                            sessionId = sessionId,
                        )
                        applyAttributes(event, resolvedThreadName)
                        val transformedEvent = InternalTrace.trace(
                            label = { "msr-transform-event" },
                            block = { eventTransformer.transform(event) },
                        )

                        if (transformedEvent != null) {
                            InternalTrace.trace(label = { "msr-store-event" }, block = {
                                signalStore.store(event)
                                onEventTracked(event)
                            })
                        }
                    },
                )
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Error, "Failed to process event", e)
        }
    }

    // This method does not apply event transformer or trigger onEventTracked callback as the
    // app exit event is triggered for a previous session and doesn't need to update state
    // or transform the event.
    override fun trackAppExit(
        data: AppExit,
        timestamp: Long,
        type: EventType,
        threadName: String,
        sessionId: String,
        appVersion: String?,
        appBuild: String?,
    ) {
        InternalTrace.trace(
            label = { "msr-trackEvent" },
            block = {
                val event = createEvent(
                    data = data,
                    timestamp = timestamp,
                    type = type,
                    attachments = mutableListOf(),
                    attributes = mutableMapOf(),
                    userTriggered = false,
                    userDefinedAttributes = mutableMapOf(),
                    sessionId = sessionId,
                )
                applyAttributes(event, threadName)
                event.updateVersionAttribute(appVersion, appBuild)
                InternalTrace.trace(label = { "msr-store-event" }, block = {
                    signalStore.store(event)
                })
            },
        )
    }

    override fun trackCrash(
        data: ExceptionData,
        timestamp: Long,
        type: EventType,
        attributes: MutableMap<String, Any?>,
        userDefinedAttributes: Map<String, AttributeValue>,
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
            userDefinedAttributes = userDefinedAttributes,
        )
        if (configProvider.trackScreenshotOnCrash) {
            addScreenshotAsAttachment(event)
        }
        applyAttributes(event, threadName)
        eventTransformer.transform(event)?.let {
            signalStore.store(event)
            onEventTracked(event)
            sessionManager.markCrashedSession(event.sessionId)
            exceptionExporter.export(event.sessionId)
        }
    }

    override fun trackSpan(spanData: SpanData) {
        ioExecutor.submit {
            InternalTrace.trace(
                { "msr-store-span" },
                {
                    signalStore.store(spanData)
                },
            )
        }
    }

    private fun <T> onEventTracked(event: Event<T>) {
        sessionManager.onEventTracked(event)
    }

    private fun <T> createEvent(
        timestamp: Long,
        type: EventType,
        data: T,
        attachments: MutableList<Attachment>,
        attributes: MutableMap<String, Any?>,
        userDefinedAttributes: Map<String, AttributeValue> = mutableMapOf(),
        userTriggered: Boolean,
        sessionId: String? = null,
    ): Event<T> {
        val id = idProvider.uuid()
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
            userDefinedAttributes = userDefinedAttributes,
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

    // This is a quick way to update the version attributes for app exit events.
    // AppExit events are tracked for older sessions, and the version attributes are not
    // available at that time. Instead of changing the flow of tracking events, we apply the
    // attributes as is and then mutate them here.
    private fun Event<AppExit>.updateVersionAttribute(appVersion: String?, appBuild: String?) {
        if (appVersion != null) {
            attributes[Attribute.APP_VERSION_KEY] = appVersion
        }
        if (appBuild != null) {
            attributes[Attribute.APP_BUILD_KEY] = appBuild
        }
    }
}
