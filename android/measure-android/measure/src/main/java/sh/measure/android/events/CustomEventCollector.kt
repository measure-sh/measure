package sh.measure.android.events

import sh.measure.android.attributes.AttributeValue
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
}
