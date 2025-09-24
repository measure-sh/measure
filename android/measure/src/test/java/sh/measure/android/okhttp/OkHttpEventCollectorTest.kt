package sh.measure.android.okhttp

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.net.ConnectException

class OkHttpEventCollectorTest {
    private val logger = NoopLogger()
    private val signalProcessor = mock<SignalProcessor>()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider = FakeConfigProvider()
    private val okHttpEventCollector: OkHttpEventCollector = OkHttpEventCollectorImpl(
        logger,
        signalProcessor,
        timeProvider,
        configProvider,
    )
    private val mockWebServer = MockWebServer()
    private val clientWithInterceptor: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(MeasureOkHttpApplicationInterceptor(okHttpEventCollector))
        .eventListenerFactory { okHttpEventCollector }.build()

    private val clientWithoutInterceptor: OkHttpClient =
        OkHttpClient.Builder().eventListenerFactory { okHttpEventCollector }.build()

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `disables collection when unregistered`() {
        val statusCode = 200
        okHttpEventCollector.register()
        okHttpEventCollector.unregister()

        // When
        simulateSuccessfulPostRequest(statusCode = statusCode)

        // Then
        verify(signalProcessor, never()).track(
            data = any<HttpData>(),
            timestamp = any(),
            type = any(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
    }

    @Test
    fun `event contains status code for a successful request`() {
        val statusCode = 200
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(statusCode = statusCode)

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals(statusCode, actualData.status_code)
    }

    @Test
    fun `tracks HTTP method in lowercase for a successful request`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals("post", actualData.method)
    }

    @Test
    fun `tracks request URL for a successful request`() {
        val url = "http://localhost:8080/"
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(url = url)

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals(url, actualData.url)
    }

    @Test
    fun `tracks request body for a successful request`() {
        val requestBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(requestBody = requestBody)

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val data = captor.firstValue
        Assert.assertEquals(requestBody, data.request_body)
    }

    @Test
    fun `given interceptor is not set, does not track request body for a successful request`() {
        val requestBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(requestBody = requestBody, client = clientWithoutInterceptor)

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertNull(requestBody, actualData.request_body)
    }

    @Test
    fun `tracks response body for a successful request`() {
        val responseBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(responseBody = responseBody)

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals(responseBody, actualData.response_body)
    }

    @Test
    fun `given interceptor is not set, does not track response body for a successful request`() {
        val responseBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(
            responseBody = responseBody,
            client = clientWithoutInterceptor,
        )

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertNull(responseBody, actualData.response_body)
    }

    // Not verifying the content of the headers as OkHttp adds a number of headers automatically.
    @Test
    fun `tracks request headers for a successful request`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertTrue(actualData.request_headers?.isNotEmpty() == true)
    }

    // Not verifying the content of the headers as OkHttp adds a number of headers automatically.
    @Test
    fun `tracks response headers for a successful request`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertTrue(actualData.response_headers?.isNotEmpty() == true)
    }

    @Test
    fun `tracks a non null start and end time for a successful request`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertNotNull(actualData.start_time)
        Assert.assertNotNull(actualData.end_time)
    }

    @Test
    fun `tracks timestamp for a successful request`() {
        val dataCaptor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(signalProcessor, times(1)).track(
            data = dataCaptor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualTimestamp = timestampCaptor.firstValue
        // timestamp is non-null, initialized to -1L to remain transient
        Assert.assertNotEquals(-1L, actualTimestamp)
    }

    @Test
    fun `tracks empty request headers map for a failed request`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        try {
            val response = clientWithInterceptor.newCall(
                Request.Builder().url("http://localhost:9999/")
                    .header("Content-Type", "application/json").get().build(),
            ).execute()
            response.body!!.source().readByteString()
        } catch (_: Exception) {
            // ignore
        }

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals(actualData.request_headers, emptyMap<String, String>())
    }

    @Test
    fun `tracks client for a successful request`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals(HttpClientName.OK_HTTP, actualData.client)
    }

    @Test
    fun `tracks failure reason and failure description for a connection failure`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateConnectionFailed()

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals("java.net.ConnectException", actualData.failure_reason)
        Assert.assertNotNull(actualData.failure_description)

        // ensure rest of the data fields are not set
        Assert.assertNull(actualData.status_code)
        Assert.assertNull(actualData.request_body)
        Assert.assertNull(actualData.response_body)
        Assert.assertEquals(actualData.request_headers, emptyMap<String, String>())
        Assert.assertEquals(actualData.response_headers, emptyMap<String, String>())
    }

    @Test
    fun `tracks non null call start and call end for connection failure`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        okHttpEventCollector.register()

        // When
        simulateConnectionFailed()

        // Then
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertNotNull(actualData.start_time)
        Assert.assertNotNull(actualData.end_time)
    }

    @Test
    fun `does not track event if trackHttpUrl is false`() {
        configProvider.shouldTrackHttpUrl = false
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(url = "http://localhost:8080/")

        // Then
        Mockito.verifyNoInteractions(signalProcessor)
    }

    @Test
    fun `does not track headers if trackHttpHeaders is false`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        configProvider.trackHttpHeaders = false
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(signalProcessor).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertEquals(emptyMap<String, String>(), actualData.request_headers)
        Assert.assertEquals(emptyMap<String, String>(), actualData.response_headers)
    }

    @Test
    fun `does not track headers in httpHeadersBlocklist`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        configProvider.trackHttpHeaders = true
        configProvider.httpHeadersBlocklist = listOf("x-custom-header")
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(
            requestHeader = Pair("x-custom-header", "request-header"),
            responseHeader = Pair("x-custom-header", "response-header"),
        )

        // Then
        verify(signalProcessor).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertNotNull(actualData.request_headers)
        Assert.assertNotNull(actualData.response_headers)
        Assert.assertNull(actualData.request_headers?.get("x-custom-header"))
        Assert.assertNull(actualData.response_headers?.get("x-custom-header"))
    }

    @Test
    fun `does not track request and response body if shouldTrackHttpBody returns false`() {
        val captor = argumentCaptor<HttpData>()
        val timestampCaptor = argumentCaptor<Long>()
        val typeCaptor = argumentCaptor<EventType>()
        configProvider.shouldTrackHttpBody = false
        okHttpEventCollector.register()

        // When
        simulateSuccessfulPostRequest(
            requestBody = "{\"key\":\"value\"}\"",
            responseBody = "{\"key\":\"value\"}\",",
        )

        // Then
        verify(signalProcessor).track(
            data = captor.capture(),
            timestamp = timestampCaptor.capture(),
            type = typeCaptor.capture(),
            attributes = eq(mutableMapOf()),
            userDefinedAttributes = eq(emptyMap()),
            attachments = eq(mutableListOf()),
            threadName = eq(null),
            sessionId = eq(null),
            userTriggered = eq(false),
        )
        val actualData = captor.firstValue
        Assert.assertNull(actualData.request_body)
        Assert.assertNull(actualData.response_body)
    }

    /**
     * Creates a mock server and enqueues a successful response for a POST request.
     * Then consumes the response to ensure all events for EventFactory are triggered.
     *
     * @param client the OkHttpClient to use for the request
     * @param statusCode the HTTP status code to return
     * @param url the URL to send the request to
     * @param requestBody the request body to send
     * @param responseBody the response body to return from mock server
     */
    private fun simulateSuccessfulPostRequest(
        client: OkHttpClient = clientWithInterceptor,
        statusCode: Int = 200,
        requestHeader: Pair<String, String> = Pair("x-custom-header", "request-header"),
        responseHeader: Pair<String, String> = Pair("x-custom-header", "response-header"),
        url: String = "http://localhost:8080/",
        requestBody: String = "{ \"key\": \"value\" }",
        responseBody: String = "{ \"key\": \"value\" }",
    ) {
        mockWebServer.let {
            it.enqueue(
                MockResponse().setResponseCode(statusCode).setBody(responseBody)
                    .setHeader("Content-Type", "application/json")
                    .setHeader(responseHeader.first, responseHeader.second),
            )
            it.start(8080)
        }
        val response = client.newCall(
            Request.Builder().url(url)
                .header("Content-Type", "application/json")
                .header(requestHeader.first, requestHeader.second)
                .post(requestBody.toRequestBody()).build(),
        ).execute()
        response.body!!.source().readByteString()
    }

    /**
     * Creates a request to a non-existent server to simulate a connection failure.
     */
    private fun simulateConnectionFailed() {
        try {
            val response = clientWithInterceptor.newCall(
                Request.Builder().url("http://localhost:9999/")
                    .header("Content-Type", "application/json").get().build(),
            ).execute()
            response.body!!.source().readByteString()
        } catch (_: ConnectException) {
            // ignore
        }
    }
}
