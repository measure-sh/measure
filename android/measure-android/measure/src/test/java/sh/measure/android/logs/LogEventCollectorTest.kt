package sh.measure.android.logs

import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import sh.measure.android.attributes.StringAttr
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.Logger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.TimeProvider

class LogEventCollectorTest {
    private val logger: Logger = NoopLogger()
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider: TimeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider: ConfigProvider = FakeConfigProvider()
    private val collector: LogEventCollector = LogEventCollector(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        configProvider = configProvider,
    )

    @Before
    fun setup() {
        collector.register()
    }

    @Test
    fun `trackLog should not process logs when collector is disabled`() {
        collector.unregister()
        collector.trackLog("message", LogSeverity.Info)

        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackLog should track log with severity and current timestamp`() {
        collector.trackLog("message", LogSeverity.Warning)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LOG,
            data = LogData(severityText = "warning", severityNumber = 16, body = "message"),
            userTriggered = true,
            userDefinedAttributes = emptyMap(),
        )
    }

    @Test
    fun `trackLog should track log with attributes`() {
        val attributes = mapOf("key" to StringAttr("value"))
        collector.trackLog("message", LogSeverity.Error, attributes = attributes)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LOG,
            data = LogData(severityText = "error", severityNumber = 20, body = "message"),
            userTriggered = true,
            userDefinedAttributes = attributes,
        )
    }

    @Test
    fun `trackLog should drop log when message is empty`() {
        collector.trackLog("", LogSeverity.Info)
        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackLog should truncate message exceeding maximum length`() {
        val message = "a".repeat(configProvider.maxLogBodyLength + 1)
        collector.trackLog(message, LogSeverity.Info)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LOG,
            data = LogData(
                severityText = "info",
                severityNumber = 12,
                body = "a".repeat(configProvider.maxLogBodyLength),
            ),
            userTriggered = true,
            userDefinedAttributes = emptyMap(),
        )
    }

    @Test
    fun `trackLog should track auto collected logs with user triggered set to false`() {
        collector.trackLog("message", LogSeverity.Debug, userTriggered = false)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LOG,
            data = LogData(severityText = "debug", severityNumber = 8, body = "message"),
            userTriggered = false,
            userDefinedAttributes = emptyMap(),
        )
    }

    @Test
    fun `trackLog should drop logs below the configured minimum level`() {
        (configProvider as FakeConfigProvider).logMinSeverity = 16

        collector.trackLog("message", LogSeverity.Debug)
        collector.trackLog("message", LogSeverity.Info)

        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackLog should track logs at or above the configured minimum level`() {
        (configProvider as FakeConfigProvider).logMinSeverity = 16

        collector.trackLog("message", LogSeverity.Warning)
        collector.trackLog("message", LogSeverity.Error)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LOG,
            data = LogData(severityText = "warning", severityNumber = 16, body = "message"),
            userTriggered = true,
            userDefinedAttributes = emptyMap(),
        )
        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.LOG,
            data = LogData(severityText = "error", severityNumber = 20, body = "message"),
            userTriggered = true,
            userDefinedAttributes = emptyMap(),
        )
    }

    @Test
    fun `trackLog should drop logs whose body matches a discard pattern`() {
        (configProvider as FakeConfigProvider).logIgnorePatterns = listOf("secret")

        collector.trackLog("this contains a secret value", LogSeverity.Error)

        verifyNoInteractions(signalProcessor)
    }
}
