package sh.measure.android.events

import kotlinx.serialization.json.Json
import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.toEventAttachment
import sh.measure.android.utils.toJsonElement

internal class InternalSignalCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
) {
    fun trackEvent(
        data: Map<String, Any?>,
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

        try {
            when (type) {
                EventType.CUSTOM.value -> {
                    val customEventData = extractCustomEventData(data)
                    signalProcessor.track(
                        data = customEventData,
                        timestamp = timestamp,
                        type = EventType.CUSTOM,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                        attachments = eventAttachments,
                        threadName = threadName,
                        sessionId = sessionId,
                        userTriggered = userTriggered,
                    )
                }

                else -> {
                    logger.log(LogLevel.Error, "Unimplemented event type: $type")
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to decode event $type", e)
        }
    }

    private fun extractCustomEventData(data: Map<String, Any?>): CustomEventData {
        return Json.decodeFromJsonElement(CustomEventData.serializer(), data.toJsonElement())
    }
}
