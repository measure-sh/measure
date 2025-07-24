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
        logger.log(LogLevel.Debug, "Custom event($name) received")
    }

    private fun validateName(name: String): Boolean {
        if (name.isEmpty()) {
            logger.log(
                LogLevel.Error,
                "Invalid event: name is empty",
            )
            return false
        }

        if (name.length > configProvider.maxEventNameLength) {
            logger.log(
                LogLevel.Error,
                "Invalid event($name): name exceeds maximum length of ${configProvider.maxEventNameLength} characters",
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
                LogLevel.Error,
                "Invalid event($name): exceeds maximum of ${configProvider.maxUserDefinedAttributesPerEvent} attributes",
            )
            return false
        }

        return attributes.all { (key, value) ->
            val isKeyValid = isKeyValid(key)
            val isValueValid = isValueValid(value)
            if (!isKeyValid) {
                logger.log(
                    LogLevel.Error,
                    "Invalid event($name): invalid attribute key: $key",
                )
            }
            if (!isValueValid) {
                logger.log(
                    LogLevel.Error,
                    "Invalid event($name): invalid attribute value: $value",
                )
            }
            isKeyValid && isValueValid
        }
    }

    private fun isKeyValid(key: String): Boolean = key.length <= configProvider.maxUserDefinedAttributeKeyLength

    private fun isValueValid(value: AttributeValue): Boolean = when (value) {
        is StringAttr -> value.value.length <= configProvider.maxUserDefinedAttributeValueLength
        else -> true
    }
}
