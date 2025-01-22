package sh.measure.android.events

import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.StringAttr
import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal class CustomEventCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) {
    private val isEnabled = AtomicBoolean(false)
    private val customEventNameRegex by lazy { Regex(configProvider.customEventNameRegex) }

    fun register() {
        isEnabled.set(true)
    }

    fun unregister() {
        isEnabled.set(false)
    }

    fun trackEvent(name: String, attributes: Map<String, AttributeValue>, timestamp: Long?) {
        if (!isEnabled.get()) {
            return
        }
        if (!validateName(name)) {
            return
        }
        if (!validateAttributes(name, attributes)) {
            return
        }
        val data = CustomEventData(name)
        signalProcessor.track(
            timestamp = timestamp ?: timeProvider.now(),
            type = EventType.CUSTOM,
            data = data,
            userTriggered = true,
            userDefinedAttributes = attributes,
        )
    }

    private fun validateName(name: String): Boolean {
        if (name.isEmpty()) {
            logger.log(
                LogLevel.Warning,
                "Event name is empty. This event will be dropped.",
            )
            return false
        }

        if (name.length > configProvider.maxEventNameLength) {
            logger.log(
                LogLevel.Warning,
                "Event($name) exceeded max allowed length. This event will be dropped.",
            )
            return false
        }

        if (!name.matches(customEventNameRegex)) {
            return false
        }

        return true
    }

    private fun validateAttributes(name: String, attributes: Map<String, AttributeValue>): Boolean {
        if (attributes.size > configProvider.maxUserDefinedAttributesPerEvent) {
            logger.log(
                LogLevel.Warning,
                "Event($name) contains more than max allowed attributes. This event will be dropped.",
            )
            return false
        }

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

    private fun isKeyValid(key: String): Boolean {
        return key.length <= configProvider.maxUserDefinedAttributeKeyLength
    }

    private fun isValueValid(value: AttributeValue): Boolean {
        return when (value) {
            is StringAttr -> value.value.length <= configProvider.maxUserDefinedAttributeValueLength
            else -> true
        }
    }
}
