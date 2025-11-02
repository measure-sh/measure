package sh.measure.android.events

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
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportData
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.toEventAttachment
import sh.measure.android.tracing.Checkpoint
import sh.measure.android.tracing.SpanStatus

class InternalSignalCollectorTest {
    private val signalProcessor = mock<SignalProcessor>()
    private val configProvider = FakeConfigProvider()
    private val processInfoProvider = FakeProcessInfoProvider()
    private val sessionManager = FakeSessionManager()
    private val attributeProcessor = object : AttributeProcessor {
        override fun appendAttributes(attributes: MutableMap<String, Any?>) {
            attributes.put("key-processor", "value-processor")
        }
    }
    private val internalSignalCollector = InternalSignalCollector(
        logger = NoopLogger(),
        configProvider = configProvider,
        signalProcessor = signalProcessor,
        processInfoProvider = processInfoProvider,
        sessionManager = sessionManager,
        spanAttributeProcessors = listOf(attributeProcessor),
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
    fun `trackEvent tracks screen view event`() {
        val data = mutableMapOf<String, Any?>("name" to "screen_name")
        val type = EventType.SCREEN_VIEW
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = false

        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = null,
            threadName = null,
        )

        verify(signalProcessor).track(
            data = ScreenViewData("screen_name"),
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            threadName = null,
            sessionId = null,
            userTriggered = userTriggered,
        )
    }

    @Test
    fun `trackEvent tracks successful http event`() {
        val data = mutableMapOf(
            "url" to "https://example.com",
            "method" to "POST",
            "status_code" to 200,
            "start_time" to 1234567890L,
            "end_time" to 1234569990L,
            "request_headers" to mapOf("key" to "value"),
            "response_headers" to mapOf("key" to "value"),
            "request_body" to "{\"key\":\"value\"}",
            "response_body" to "{\"key\":\"value\"}",
            "client" to "dio",
            "failure_reason" to null,
            "failure_description" to null,
        )
        val type = EventType.HTTP
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = false

        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = null,
            threadName = null,
        )

        verify(signalProcessor).track(
            data = HttpData(
                url = "https://example.com",
                method = "POST",
                status_code = 200,
                start_time = 1234567890L,
                end_time = 1234569990L,
                request_headers = mapOf("key" to "value"),
                response_headers = mapOf("key" to "value"),
                request_body = "{\"key\":\"value\"}",
                response_body = "{\"key\":\"value\"}",
                client = "dio",
                failure_reason = null,
                failure_description = null,
            ),
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            userTriggered = userTriggered,
        )
    }

    @Test
    fun `trackEvent tracks failed http event`() {
        val data = mutableMapOf<String, Any?>(
            "url" to "https://example.com",
            "method" to "GET",
            "status_code" to null,
            "start_time" to 1234567890L,
            "end_time" to 1234569990L,
            "request_headers" to null,
            "response_headers" to null,
            "request_body" to null,
            "response_body" to null,
            "client" to "dio",
            "failure_reason" to "failed to connect",
            "failure_description" to "no internet",
        )
        val type = EventType.HTTP
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = false

        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = null,
            threadName = null,
        )

        verify(signalProcessor).track(
            data = HttpData(
                url = "https://example.com",
                method = "GET",
                status_code = null,
                start_time = 1234567890L,
                end_time = 1234569990L,
                request_headers = null,
                response_headers = null,
                request_body = null,
                response_body = null,
                client = "dio",
                failure_reason = "failed to connect",
                failure_description = "no internet",
            ),
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            userTriggered = userTriggered,
        )
    }

    @Test
    fun `trackEvent tracks un-obfuscated flutter exception event`() {
        val exceptionData = TestData.getUnObfuscatedFlutterExceptionData(handled = false)
        val jsonElement = jsonSerializer.encodeToJsonElement(exceptionData)
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
            threadName = threadName,
            takeScreenshot = false,
        )
    }

    @Test
    fun `trackEvent tracks obfuscated flutter exception event`() {
        val exceptionData = TestData.getObfuscatedFlutterExceptionData(handled = false)
        val jsonElement = jsonSerializer.encodeToJsonElement(exceptionData)
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
            threadName = threadName,
            takeScreenshot = false,
        )
    }

    @Test
    fun `trackEvent tracks handled flutter exception event`() {
        val exceptionData = TestData.getUnObfuscatedFlutterExceptionData(handled = true)
        val jsonElement = jsonSerializer.encodeToJsonElement(exceptionData)
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
        val jsonElement = jsonSerializer.encodeToJsonElement(exceptionData)
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
            threadName = threadName,
            takeScreenshot = false,
        )
    }

    @Test
    fun `trackEvent tracks bug_report event without attachments`() {
        val data = mutableMapOf<String, Any?>(
            "description" to "test bug report without attachments",
        )
        val type = EventType.BUG_REPORT
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf<MsrAttachment>()
        val userTriggered = true

        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = null,
            threadName = null,
        )

        verify(signalProcessor).trackBugReport(
            data = BugReportData(
                description = "test bug report without attachments",
            ),
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = mutableListOf(),
            userTriggered = userTriggered,
        )
    }

    @Test
    fun `trackEvent tracks bug_report event with only attachments`() {
        val data = mutableMapOf<String, Any?>(
            "description" to "",
        )
        val type = EventType.BUG_REPORT
        val timestamp = 1234567890L
        val attributes = mutableMapOf<String, Any?>()
        val userDefinedAttrs = mutableMapOf<String, AttributeValue>()
        val attachments = mutableListOf(
            MsrAttachment(
                name = "screenshot",
                path = "fake/path",
                type = AttachmentType.SCREENSHOT,
            ),
        )
        val userTriggered = true

        internalSignalCollector.trackEvent(
            data = data,
            type = type.value,
            timestamp = timestamp,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = null,
            threadName = null,
        )

        verify(signalProcessor).trackBugReport(
            data = BugReportData(
                description = "",
            ),
            timestamp = timestamp,
            type = type,
            attributes = attributes,
            userDefinedAttributes = userDefinedAttrs,
            attachments = attachments.map { it.toEventAttachment(AttachmentType.SCREENSHOT) }
                .toMutableList(),
            userTriggered = userTriggered,
        )
    }

    @Test
    fun `trackSpan with valid input map tracks span with session ID and attributes applied`() {
        val expectedSpanData = TestData.getSpanData(
            name = "span_name",
            traceId = "trace_id",
            spanId = "span_id",
            sessionId = sessionManager.getSessionId(),
            parentId = "parent_id",
            startTime = 1234567890L,
            endTime = 1234568890L,
            duration = 1000,
            status = SpanStatus.Ok,
            attributes = mapOf("key" to "value", "key-processor" to "value-processor"),
            userDefinedAttrs = mutableMapOf("key" to "value"),
            checkpoints = mutableListOf(
                Checkpoint("checkpoint_name", 1234567890L),
            ),
            hasEnded = true,
            isSampled = true,
        )

        // When
        internalSignalCollector.trackSpan(
            name = "span_name",
            traceId = "trace_id",
            spanId = "span_id",
            parentId = "parent_id",
            startTime = 1234567890L,
            endTime = 1234568890L,
            duration = 1000,
            status = SpanStatus.Ok.value,
            attributes = mutableMapOf("key" to "value"),
            userDefinedAttrs = mutableMapOf("key" to "value"),
            checkpoints = mapOf("checkpoint_name" to 1234567890L),
            hasEnded = true,
            isSampled = true,
        )

        // Then
        verify(signalProcessor).trackSpan(expectedSpanData)
    }

    @Test
    fun `trackSpan samples span if enableFullConfigMode is enabled`() {
        configProvider.enableFullCollectionMode = true
        val spanData = TestData.getSpanData(
            name = "span_name",
            traceId = "trace_id",
            spanId = "span_id",
            sessionId = sessionManager.getSessionId(),
            parentId = "parent_id",
            startTime = 123456789L,
            endTime = 123456890L,
            duration = 1000,
            status = SpanStatus.Ok,
            attributes = mapOf("key" to "value", "key-processor" to "value-processor"),
            checkpoints = mutableListOf(
                Checkpoint("checkpoint_name", 1234567890L),
            ),
            hasEnded = true,
            isSampled = true,
        )

        internalSignalCollector.trackSpan(
            name = spanData.name,
            traceId = spanData.traceId,
            spanId = spanData.spanId,
            parentId = spanData.parentId,
            startTime = spanData.startTime,
            endTime = spanData.endTime,
            duration = spanData.duration,
            status = spanData.status.value,
            attributes = spanData.attributes.toMutableMap(),
            userDefinedAttrs = spanData.userDefinedAttrs,
            checkpoints = spanData.checkpoints.associate {
                it.name to it.timestamp
            },
            hasEnded = spanData.hasEnded,
            // sampling rate is false for the span
            // but gets flipped due to enableFullCollectionMode
            isSampled = false,
        )

        verify(signalProcessor).trackSpan(spanData)
    }

    @Test
    fun `trackSpan keep span sampling rate if enableFullConfigMode is disabled`() {
        configProvider.enableFullCollectionMode = false
        val spanData = TestData.getSpanData(
            name = "span_name",
            traceId = "trace_id",
            spanId = "span_id",
            sessionId = sessionManager.getSessionId(),
            parentId = "parent_id",
            startTime = 123456789L,
            endTime = 123456890L,
            duration = 1000,
            status = SpanStatus.Ok,
            attributes = mapOf("key" to "value", "key-processor" to "value-processor"),
            checkpoints = mutableListOf(
                Checkpoint("checkpoint_name", 1234567890L),
            ),
            hasEnded = true,
            isSampled = false,
        )

        internalSignalCollector.trackSpan(
            name = spanData.name,
            traceId = spanData.traceId,
            spanId = spanData.spanId,
            parentId = spanData.parentId,
            startTime = spanData.startTime,
            endTime = spanData.endTime,
            duration = spanData.duration,
            status = spanData.status.value,
            attributes = spanData.attributes.toMutableMap(),
            userDefinedAttrs = spanData.userDefinedAttrs,
            checkpoints = spanData.checkpoints.associate {
                it.name to it.timestamp
            },
            hasEnded = spanData.hasEnded,
            isSampled = false,
        )

        verify(signalProcessor).trackSpan(spanData)
    }

    private fun jsonToMap(jsonObject: JsonObject): MutableMap<String, Any?> {
        val destination = mutableMapOf<String, Any?>()
        jsonObject.mapValuesTo(destination) { parseJsonElement(it.value) }
        return destination
    }

    private fun parseJsonElement(element: JsonElement): Any? = when (element) {
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
