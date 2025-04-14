package sh.measure.android.events

import org.junit.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.fakes.NoopLogger

class InternalSignalCollectorTest {
    private val signalProcessor = mock<SignalProcessor>()
    private val internalSignalCollector = InternalSignalCollector(
        logger = NoopLogger(),
        signalProcessor = signalProcessor,
    )

    @Test
    fun `trackEvent without platform attribute should not track event`() {
        val data = mapOf<String, Any?>()
        val type = EventType.CUSTOM
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()

        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = mutableMapOf(),
            attachments = mutableListOf(),
            userTriggered = true,
            sessionId = null,
            threadName = null,
        )

        verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `trackEvent tracks custom event`() {
        val data = mapOf("name" to "test_event")
        val type = EventType.CUSTOM
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = true
        val sessionId = "session_id"
        val threadName = "thread_name"

        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = sessionId,
            threadName = threadName,
        )

        verify(signalProcessor).track(
            data = CustomEventData("test_event"),
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            threadName = threadName,
            sessionId = sessionId,
            userTriggered = userTriggered,
        )
    }

    @Test
    fun `trackEvent does not track event for invalid argument and fails gracefully`() {
        val data = mapOf("name" to 123) // Invalid argument type
        val type = EventType.CUSTOM
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = true
        val sessionId = "session_id"
        val threadName = "thread_name"
        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = sessionId,
            threadName = threadName,
        )

        verifyNoInteractions(signalProcessor)
    }
}
