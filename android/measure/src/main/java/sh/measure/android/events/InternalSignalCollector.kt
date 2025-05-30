package sh.measure.android.events

import kotlinx.serialization.json.Json
import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.toEventAttachment
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.toJsonElement

/**
 * Processes and tracks events received from cross platform sources like Flutter/RN.
 */
internal class InternalSignalCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
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

                else -> {
                    logger.log(LogLevel.Error, "Unknown event type: $type")
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to decode event $type", e)
        }
    }

    private fun extractExceptionEventData(map: Map<String, Any?>): ExceptionData {
        return Json.decodeFromJsonElement(ExceptionData.serializer(), map.toJsonElement())
    }

    private fun extractCustomEventData(data: Map<String, Any?>): CustomEventData {
        return Json.decodeFromJsonElement(CustomEventData.serializer(), data.toJsonElement())
    }
}
