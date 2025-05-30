package sh.measure.android.events

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull
import org.junit.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData

class InternalSignalCollectorTest {
    private val signalProcessor = mock<SignalProcessor>()
    private val processInfoProvider = FakeProcessInfoProvider()
    private val internalSignalCollector = InternalSignalCollector(
        logger = NoopLogger(),
        signalProcessor = signalProcessor,
        processInfoProvider = processInfoProvider,
    )

    @Test
    fun `trackEvent without platform attribute should not track event`() {
        val data = mutableMapOf<String, Any?>()
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
        val data = mutableMapOf<String, Any?>("name" to "test_event")
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
        val data = mutableMapOf<String, Any?>("name" to 123) // Invalid argument type
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

    @Test
    fun `trackEvent tracks un-obfuscated flutter exception event`() {
        val exceptionData = TestData.getUnObfuscatedFlutterExceptionData(handled = false)
        val jsonElement = Json.encodeToJsonElement(exceptionData)
        val data = jsonToMap(jsonElement.jsonObject)
        val type = EventType.EXCEPTION
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = true
        val sessionId = "session_id"
        val threadName = "thread_name"

        internalSignalCollector.trackEvent(
            data = data.toMutableMap(),
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = sessionId,
            threadName = threadName,
        )

        verify(signalProcessor).trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            threadName = threadName,
        )
    }

    @Test
    fun `trackEvent tracks obfuscated flutter exception event`() {
        val exceptionData = TestData.getObfuscatedFlutterExceptionData(handled = false)
        val jsonElement = Json.encodeToJsonElement(exceptionData)
        val data = jsonToMap(jsonElement.jsonObject)
        val type = EventType.EXCEPTION
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = true
        val sessionId = "session_id"
        val threadName = "thread_name"

        internalSignalCollector.trackEvent(
            data = data.toMutableMap(),
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = sessionId,
            threadName = threadName,
        )

        verify(signalProcessor).trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            threadName = threadName,
        )
    }

    @Test
    fun `trackEvent tracks handled flutter exception event`() {
        val exceptionData = TestData.getUnObfuscatedFlutterExceptionData(handled = true)
        val jsonElement = Json.encodeToJsonElement(exceptionData)
        val data = jsonToMap(jsonElement.jsonObject)
        val type = EventType.EXCEPTION
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = true
        val sessionId = "session_id"
        val threadName = "thread_name"

        internalSignalCollector.trackEvent(
            data = data.toMutableMap(),
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
            data = exceptionData,
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
    fun `trackEvent for flutter exception updates foreground property`() {
        processInfoProvider.foregroundProcess = true
        val exceptionData = TestData.getUnObfuscatedFlutterExceptionData(foreground = false)
        val jsonElement = Json.encodeToJsonElement(exceptionData)
        val data = jsonToMap(jsonElement.jsonObject)
        val type = EventType.EXCEPTION
        val timestamp = 12345L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = true
        val sessionId = "session_id"
        val threadName = "thread_name"
        internalSignalCollector.trackEvent(
            data = data.toMutableMap(),
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = sessionId,
            threadName = threadName,
        )

        verify(signalProcessor).trackCrash(
            data = exceptionData.copy(foreground = true),
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            threadName = threadName,
        )
    }

    private fun jsonToMap(jsonObject: JsonObject): MutableMap<String, Any?> {
        val destination = mutableMapOf<String, Any?>()
        jsonObject.mapValuesTo(destination) { parseJsonElement(it.value) }
        return destination
    }

    private fun parseJsonElement(element: JsonElement): Any? {
        return when (element) {
            is JsonObject -> jsonToMap(element)
            is JsonArray -> element.map { parseJsonElement(it) }
            is JsonPrimitive -> when {
                element.isString -> element.content
                element.booleanOrNull != null -> element.boolean
                element.intOrNull != null -> element.int
                element.longOrNull != null -> element.long
                element.doubleOrNull != null -> element.double
                else -> null
            }

            JsonNull -> null
        }
    }
}
