package sh.measure.android.events

import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.toEventAttachment
import sh.measure.android.tracing.SpanData
import sh.measure.android.tracing.SpanProcessor
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.toJsonElement

/**
 * Processes and tracks events received from cross platform sources like Flutter/RN.
 */
internal class InternalSignalCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val spanProcessor: SpanProcessor,
    private val processInfoProvider: ProcessInfoProvider,
) {
    fun trackEvent(
        data: MutableMap<String, Any?>,
        type: String,
        timestamp: Long,
        attributes: MutableMap<String, Any?>,
        userDefinedAttrs: MutableMap<String, AttributeValue>,
        attachments: MutableList<MsrAttachment>,
        userTriggered: Boolean,
        sessionId: String?,
        threadName: String?,
    ) {
        val eventAttachments = mutableListOf<Attachment>()
        attachments.mapTo(eventAttachments) { it.toEventAttachment(it.type) }
        val eventType = EventType.fromValue(type)
        if (eventType == null) {
            logger.log(LogLevel.Error, "Unknown event type: $type")
            return
        }

        try {
            when (eventType) {
                EventType.CUSTOM -> {
                    val data = extractCustomEventData(data)
                    signalProcessor.track(
                        data = data,
                        timestamp = timestamp,
                        type = eventType,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                        attachments = eventAttachments,
                        threadName = threadName,
                        sessionId = sessionId,
                        userTriggered = userTriggered,
                    )
                }

                EventType.EXCEPTION -> {
                    // adding foreground property to the exception data here
                    // as we don't want to add duplicate logic in Flutter/RN
                    // to find out whether the app is in foreground or not.
                    if (data.containsKey("foreground")) {
                        data["foreground"] = processInfoProvider.isForegroundProcess()
                    } else {
                        logger.log(
                            LogLevel.Debug,
                            "invalid exception event, missing foreground property",
                        )
                    }
                    val data = extractExceptionEventData(data)
                    if (!data.handled) {
                        // ignoring session ID and user triggered properties
                        // this should be safe as handled exceptions are not tracked in
                        // a separate session and are not user triggered.
                        signalProcessor.trackCrash(
                            data = data,
                            timestamp = timestamp,
                            type = eventType,
                            attributes = attributes,
                            userDefinedAttributes = userDefinedAttrs,
                            attachments = eventAttachments,
                            threadName = threadName,
                        )
                    } else {
                        signalProcessor.track(
                            data = data,
                            timestamp = timestamp,
                            type = eventType,
                            attributes = attributes,
                            userDefinedAttributes = userDefinedAttrs,
                            attachments = eventAttachments,
                            threadName = threadName,
                            sessionId = sessionId,
                            userTriggered = userTriggered,
                        )
                    }
                }

                EventType.SCREEN_VIEW -> {
                    val data = extractScreenViewData(data)
                    signalProcessor.track(
                        data = data,
                        timestamp = timestamp,
                        type = eventType,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                    )
                }

                EventType.HTTP -> {
                    val data = extractHttpData(data)
                    signalProcessor.track(
                        data = data,
                        timestamp = timestamp,
                        type = eventType,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                    )
                }

                else -> {
                    logger.log(LogLevel.Error, "Unknown event type: $type")
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to decode event $type", e)
        }
    }

    private fun extractHttpData(map: MutableMap<String, Any?>): HttpData {
        return jsonSerializer.decodeFromJsonElement(HttpData.serializer(), map.toJsonElement())
    }

    private fun extractScreenViewData(map: MutableMap<String, Any?>): ScreenViewData {
        return jsonSerializer.decodeFromJsonElement(ScreenViewData.serializer(), map.toJsonElement())
    }

    private fun extractExceptionEventData(map: Map<String, Any?>): ExceptionData {
        return jsonSerializer.decodeFromJsonElement(ExceptionData.serializer(), map.toJsonElement())
    }

    private fun extractCustomEventData(data: Map<String, Any?>): CustomEventData {
        return jsonSerializer.decodeFromJsonElement(CustomEventData.serializer(), data.toJsonElement())
    }

    fun trackSpan(data: MutableMap<String, Any?>) {
        val spanData = SpanData.fromJson(data)
        logger.log(LogLevel.Debug, spanData.toString())
        spanProcessor.trackSpan(spanData)
    }
}
