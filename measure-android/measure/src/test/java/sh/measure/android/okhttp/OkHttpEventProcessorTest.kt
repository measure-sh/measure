package sh.measure.android.okhttp

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import sh.measure.android.events.EventTracker
import sh.measure.android.fakes.FakeConfig
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.CurrentThread
import java.net.ConnectException

class OkHttpEventProcessorTest {
    private val logger = NoopLogger()
    private val eventTracker = mock<EventTracker>()
    private val timeProvider = FakeTimeProvider()
    private val currentThread = CurrentThread()
    private val config = FakeConfig()
    private val okHttpEventProcessor: OkHttpEventProcessor = OkHttpEventProcessorImpl(
        logger,
        eventTracker,
        timeProvider,
        currentThread,
        config,
    )
    private val mockWebServer = MockWebServer()
    private val clientWithInterceptor: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(MeasureOkHttpApplicationInterceptor(okHttpEventProcessor))
        .eventListenerFactory { okHttpEventProcessor }.build()

    private val clientWithoutInterceptor: OkHttpClient = OkHttpClient.Builder()
        .eventListenerFactory { okHttpEventProcessor }
        .build()

    @Before
    fun setUp() {
        // enable body tracking by default
        config.setHttpBodyTracking(true)
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `event contains status code for a successful request`() {
        val statusCode = 200
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(statusCode = statusCode)

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals(statusCode, actualEvent.status_code)
    }

    @Test
    fun `tracks HTTP method in lowercase for a successful request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals("post", actualEvent.method)
    }

    @Test
    fun `tracks request URL for a successful request`() {
        val url = "http://localhost:8080/"
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(url = url)

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals(url, actualEvent.url)
    }

    @Test
    fun `given request body config is enabled, tracks request body for a successful request`() {
        config.setHttpBodyTracking(true)
        val requestBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(requestBody = requestBody)

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals(requestBody, actualEvent.request_body)
    }

    @Test
    fun `given interceptor is not set, does not track request body for a successful request`() {
        config.setHttpBodyTracking(true)
        val requestBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(requestBody = requestBody, client = clientWithoutInterceptor)

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertNull(requestBody, actualEvent.request_body)
    }

    @Test
    fun `given request body config is disabled, does not track request body for a successful request`() {
        config.setHttpBodyTracking(false)
        val requestBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(requestBody = requestBody)

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertNull(actualEvent.request_body)
    }

    @Test
    fun `given response body config is enabled, tracks response body for a successful request`() {
        config.setHttpBodyTracking(true)
        val responseBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(responseBody = responseBody)

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals(responseBody, actualEvent.response_body)
    }

    @Test
    fun `given response body config is disabled, does not track response body for a successful request`() {
        config.setHttpBodyTracking(false)
        val responseBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(responseBody = responseBody)

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertNull(actualEvent.response_body)
    }

    @Test
    fun `given interceptor is not set, does not track response body for a successful request`() {
        config.setHttpBodyTracking(true)
        val responseBody = "{ \"key\": \"value\" }"
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest(
            responseBody = responseBody,
            client = clientWithoutInterceptor,
        )

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertNull(responseBody, actualEvent.response_body)
    }

    // Not verifying the content of the headers as OkHttp adds a number of headers automatically.
    @Test
    fun `tracks request headers for a successful request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertTrue(actualEvent.request_headers?.isNotEmpty() == true)
    }

    // Not verifying the content of the headers as OkHttp adds a number of headers automatically.
    @Test
    fun `tracks response headers for a successful request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertTrue(actualEvent.response_headers?.isNotEmpty() == true)
    }

    @Test
    fun `tracks a non null start and end time for a successful request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertNotNull(actualEvent.start_time)
        Assert.assertNotNull(actualEvent.end_time)
    }

    @Test
    fun `tracks timestamp for a successful request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        // timestamp is non-null, initialized to -1L to remain transient
        Assert.assertNotEquals(-1L, actualEvent.timestamp)
    }

    @Test
    fun `tracks thread name for a successful request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals(currentThread.name, actualEvent.thread_name)
    }

    @Test
    fun `tracks empty request headers map for a failed request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        try {
            val response = clientWithInterceptor.newCall(
                Request.Builder().url("http://localhost:9999/")
                    .header("Content-Type", "application/json").get().build(),
            ).execute()
            response.body!!.source().readByteString()
        } catch (e: Exception) {
            // ignore
        }

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals(actualEvent.request_headers, emptyMap<String, String>())
    }

    @Test
    fun `tracks client for a successful request`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateSuccessfulPostRequest()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals(HttpClientName.OK_HTTP, actualEvent.client)
    }

    @Test
    fun `tracks failure reason and failure description for a connection failure`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateConnectionFailed()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertEquals("java.net.ConnectException", actualEvent.failure_reason)
        Assert.assertNotNull(actualEvent.failure_description)

        // ensure rest of the data fields are not set
        Assert.assertNull(actualEvent.status_code)
        Assert.assertNull(actualEvent.request_body)
        Assert.assertNull(actualEvent.response_body)
        Assert.assertEquals(actualEvent.request_headers, emptyMap<String, String>())
        Assert.assertEquals(actualEvent.response_headers, emptyMap<String, String>())
    }

    @Test
    fun `tracks non null call start and call end for connection failure`() {
        val captor = argumentCaptor<HttpEvent>()

        // When
        simulateConnectionFailed()

        // Then
        verify(eventTracker, times(1)).trackHttpEvent(captor.capture())
        val actualEvent = captor.firstValue
        Assert.assertNotNull(actualEvent.start_time)
        Assert.assertNotNull(actualEvent.end_time)
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
        url: String = "http://localhost:8080/",
        requestBody: String = "{ \"key\": \"value\" }",
        responseBody: String = "{ \"key\": \"value\" }",
    ) {
        mockWebServer.let {
            it.enqueue(
                MockResponse().setResponseCode(statusCode).setBody(responseBody)
                    .setHeader("Content-Type", "application/json"),
            )
            it.start(8080)
        }
        val response = client.newCall(
            Request.Builder().url(url).header("Content-Type", "application/json")
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
        } catch (e: ConnectException) {
            // ignore
        }
    }
}
