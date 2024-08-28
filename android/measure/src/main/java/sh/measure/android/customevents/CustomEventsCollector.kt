package sh.measure.android.customevents

import sh.measure.android.AttributeValue
import sh.measure.android.Attributes
import sh.measure.android.MeasureAttachment
import sh.measure.android.StringAttr
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage
import sh.measure.android.utils.TimeProvider

internal interface CustomEventsCollector {
    fun trackEvent(
        name: String,
        attributes: Attributes,
        attachment: MeasureAttachment?,
    )
}

internal class CustomEventsCollectorImpl(
    private val logger: Logger,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val fileStorage: FileStorage,
) : CustomEventsCollector {

    override fun trackEvent(
        name: String,
        attributes: Attributes,
        attachment: MeasureAttachment?,
    ) {
        if (!validateAttributes(name, attributes)) {
            return
        }
        val attachments: MutableList<Attachment> = processAttachment(attachment) ?: return
        trackEvent(name, attributes, attachments)
    }

    private fun validateAttributes(name: String, attributes: Attributes): Boolean {
        // validate attributes count
        if (attributes.size > configProvider.maxUserDefinedAttributesPerEvent) {
            logger.log(
                LogLevel.Warning,
                "Event($name) contains more than ${configProvider.maxUserDefinedAttributesPerEvent} attributes. This event will be dropped.",
            )
            return false
        }

        // validate attributes content
        return attributes.all { (key, value) ->
            val isKeyValid = isKeyValid(key)
            val isValueValid = isValueValid(value)
            if (!isKeyValid) {
                logger.log(
                    LogLevel.Warning,
                    "Event($name) contains invalid attribute key: $key. This event will be dropped.",
                )
            }
            if (!isValueValid) {
                logger.log(
                    LogLevel.Warning,
                    "Event($name) contains invalid attribute value: $value. This event will be dropped.",
                )
            }
            isKeyValid && isValueValid
        }
    }

    private fun processAttachment(attachment: MeasureAttachment?): MutableList<Attachment>? {
        return try {
            when {
                attachment == null -> mutableListOf()
                fileStorage.getFile(attachment.path) != null -> mutableListOf(attachment.toAttachment())
                else -> {
                    logger.log(
                        LogLevel.Warning,
                        "Attachment file does not exist: ${attachment.path}. This event will be dropped.",
                    )
                    null
                }
            }
        } catch (e: SecurityException) {
            logger.log(
                LogLevel.Warning,
                "Attachment file access denied: ${attachment?.path}. This event will be dropped.",
            )
            null
        }
    }

    private fun trackEvent(
        name: String,
        attributes: Attributes,
        attachments: MutableList<Attachment>,
    ) {
        eventProcessor.track(
            data = CustomEventData(name),
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.CUSTOM,
            userDefinedAttributes = attributes,
            attachments = attachments,
        )
    }

    private fun isKeyValid(key: String): Boolean {
        return key.length <= configProvider.maxUserDefinedAttributeKeyLength
    }

    private fun isValueValid(value: AttributeValue): Boolean {
        return when (value) {
            is StringAttr -> value.value.length <= configProvider.maxUserDefinedAttributeValueLength
            else -> true
        }
    }

    private fun MeasureAttachment.toAttachment(): Attachment {
        return Attachment(
            name = name,
            type = type,
            path = path,
        )
    }
}
