package sh.measure.android.logs

import sh.measure.android.attributes.AttributeValue
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal class LogEventCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) {
    private val isEnabled = AtomicBoolean(false)

    fun register() {
        isEnabled.set(true)
    }

    fun unregister() {
        isEnabled.set(false)
    }

    fun trackLog(
        body: String,
        severity: LogSeverity,
        attributes: Map<String, AttributeValue> = emptyMap(),
        timestamp: Long? = null,
        userTriggered: Boolean = true,
    ) {
        if (!isEnabled.get()) {
            return
        }
        if (body.isEmpty()) {
            logger.log(LogLevel.Error, "Invalid log: body is empty")
            return
        }
        if (severity.severityNumber < configProvider.minLogSeverityNumber) {
            return
        }
        val data = LogData(
            severityText = severity.value,
            severityNumber = severity.severityNumber,
            body = body.take(configProvider.maxLogMessageLength),
        )
        signalProcessor.track(
            timestamp = timestamp ?: timeProvider.now(),
            type = EventType.LOG,
            data = data,
            userTriggered = userTriggered,
            userDefinedAttributes = attributes,
        )
    }
}
