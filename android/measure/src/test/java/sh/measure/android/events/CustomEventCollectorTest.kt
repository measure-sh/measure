package sh.measure.android.events

import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import sh.measure.android.attributes.BooleanAttr
import sh.measure.android.attributes.IntAttr
import sh.measure.android.attributes.StringAttr
import sh.measure.android.config.ConfigProvider
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.Logger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.TimeProvider

class CustomEventCollectorTest {
    private val logger: Logger = NoopLogger()
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider: TimeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider: ConfigProvider = FakeConfigProvider()
    private val collector: CustomEventCollector = CustomEventCollector(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        configProvider = configProvider,
    )

    @Before
    fun setup() {
        // Enable collector
        collector.register()
    }

    @Test
    fun `trackEvent should not process events when collector is disabled`() {
        collector.unregister()
        collector.trackEvent("event", mapOf(), null)

        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent should process valid event with current timestamp when no custom timestamp provided`() {
        val eventName = "event"
        val attributes = mapOf(pair = "key" to StringAttr("value"))

        collector.trackEvent(eventName, attributes, null)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.CUSTOM,
            data = CustomEventData(eventName),
            userTriggered = true,
            userDefinedAttributes = attributes,
        )
    }

    @Test
    fun `trackEvent should use provided timestamp instead of current time`() {
        val customTimestamp = 54321L
        val eventName = "validEvent"
        val attributes = mapOf("key" to StringAttr("value"))

        collector.trackEvent(eventName, attributes, customTimestamp)

        verify(signalProcessor).track(
            timestamp = customTimestamp,
            type = EventType.CUSTOM,
            data = CustomEventData(eventName),
            userTriggered = true,
            userDefinedAttributes = attributes,
        )
    }

    @Test
    fun `trackEvent should drop event when name is empty`() {
        collector.trackEvent("", mapOf(), null)
        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent should drop event when name exceeds maximum length`() {
        val invalidEventName = "a".repeat(configProvider.maxEventNameLength + 1)
        collector.trackEvent(invalidEventName, mapOf(), null)
        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent should drop event when name does not match required pattern`() {
        collector.trackEvent("event name with spaces", mapOf(), null)
        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent should drop event when attributes exceed maximum count`() {
        val attributes = (0..configProvider.maxUserDefinedAttributesPerEvent).associate {
            "key$it" to StringAttr("value")
        }
        collector.trackEvent("validEvent", attributes, null)
        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent should drop event when attribute key exceeds maximum length`() {
        val longKey = "k".repeat(configProvider.maxUserDefinedAttributeKeyLength + 1)
        val attributes = mapOf(longKey to StringAttr("value"))
        collector.trackEvent("event", attributes, null)
        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent should drop event when string attribute value exceeds maximum length`() {
        val invalidAttributeValue =
            "v".repeat(configProvider.maxUserDefinedAttributeValueLength + 1)
        val attributes = mapOf("key" to StringAttr(invalidAttributeValue))
        collector.trackEvent("event", attributes, null)
        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent should process event with non-string attribute values without length validation`() {
        val attributes = mapOf(
            "key1" to IntAttr(123),
            "key2" to BooleanAttr(true),
        )
        collector.trackEvent("event", attributes, null)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.CUSTOM,
            data = CustomEventData("event"),
            userTriggered = true,
            userDefinedAttributes = attributes,
        )
    }

    @Test
    fun `trackEvent should track event with user triggered set to true`() {
        collector.trackEvent("event", emptyMap(), null)

        verify(signalProcessor).track(
            timestamp = timeProvider.now(),
            type = EventType.CUSTOM,
            data = CustomEventData("event"),
            userTriggered = true,
        )
    }
}
