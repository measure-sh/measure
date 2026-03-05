package sh.measure.android.exporter

import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage

class NetworkClientTest {
    private val fileStorage = mock<FileStorage>()
    private val httpClient = mock<HttpUrlConnectionClient>()
    private val configProvider = FakeConfigProvider()
    private val networkClient: NetworkClient = NetworkClientImpl(
        logger = NoopLogger(),
        fileStorage = fileStorage,
        httpClient = httpClient,
        configProvider = configProvider,
    ).apply {
        init(apiKey = "secret", baseUrl = "http://localhost:8080")
    }

    @Test
    fun `init with valid URL succeeds`() {
        networkClient.init(baseUrl = "http://localhost:8080", apiKey = "secret")
        networkClient.init(baseUrl = "http://localhost:8080/", apiKey = "secret")
        // The init method doesn't return anything, so just checking that it doesn't throw an exception
    }

    @Test
    fun `init with invalid URL logs error`() {
        val errorLogger = mock<Logger>()
        val clientWithErrorLogger = NetworkClientImpl(
            logger = errorLogger,
            fileStorage = fileStorage,
            httpClient = httpClient,
            configProvider = configProvider,
        )

        clientWithErrorLogger.init(baseUrl = "invalid-url", apiKey = "secret")

        verify(errorLogger).log(eq(LogLevel.Error), eq("Failed to send request: invalid API_URL"), any())
    }

    @Test
    fun `execute sends request with correct URL and headers`() {
        val eventPackets = listOf<EventPacket>()
        val spanPackets = listOf<SpanPacket>()

        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            HttpResponse.Success(),
        )

        networkClient.execute("batch123", eventPackets, spanPackets)

        verify(httpClient).sendJsonRequest(
            eq("http://localhost:8080/events"),
            eq("PUT"),
            eq(
                mapOf("msr-req-id" to "batch123", "Authorization" to "Bearer secret"),
            ),
            any(),
        )
    }

    @Test
    fun `execute handles successful response`() {
        val successResponse = HttpResponse.Success()
        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            successResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList())

        assertEquals(successResponse, result)
    }

    @Test
    fun `execute handles rate limit error`() {
        val rateLimitResponse = HttpResponse.Error.RateLimitError()
        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            rateLimitResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList())

        assertEquals(rateLimitResponse, result)
    }

    @Test
    fun `execute handles client error`() {
        val clientErrorResponse = HttpResponse.Error.ClientError(400)
        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            clientErrorResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList())

        assertEquals(clientErrorResponse, result)
    }

    @Test
    fun `execute handles server error`() {
        val serverErrorResponse = HttpResponse.Error.ServerError(500)
        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            serverErrorResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList())

        assertEquals(serverErrorResponse, result)
    }

    @Test
    fun `execute handles unknown error`() {
        val exception = RuntimeException("Unknown error")
        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenThrow(
            exception,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList())

        assert(result is HttpResponse.Error.UnknownError)
        assertEquals(exception, (result as HttpResponse.Error.UnknownError).exception)
    }

    @Test
    fun `execute returns error when network client is not initialized`() {
        val uninitializedNetworkClient = NetworkClientImpl(
            logger = NoopLogger(),
            fileStorage = fileStorage,
            httpClient = httpClient,
            configProvider = configProvider,
        )

        val result =
            uninitializedNetworkClient.execute("batch123", emptyList(), emptyList())
        assertTrue(result is HttpResponse.Error.UnknownError)
    }

    @Test
    fun `execute with trailing slash in base URL works correctly`() {
        networkClient.init(baseUrl = "http://localhost:8080/", apiKey = "secret")
        val eventPackets = listOf<EventPacket>()
        val spanPackets = listOf<SpanPacket>()

        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            HttpResponse.Success(),
        )

        networkClient.execute("batch123", eventPackets, spanPackets)

        verify(httpClient).sendJsonRequest(
            eq("http://localhost:8080/events"),
            any(),
            any(),
            any(),
        )
    }

    @Test
    fun `execute skips events with missing data file and logs error`() {
        val mockLogger = mock<Logger>()
        val client = NetworkClientImpl(
            logger = mockLogger,
            fileStorage = fileStorage,
            httpClient = httpClient,
            configProvider = configProvider,
        ).apply {
            init(apiKey = "secret", baseUrl = "http://localhost:8080")
        }

        val event = EventPacket(
            eventId = "event-1",
            sessionId = "session-1",
            timestamp = "2024-01-01T00:00:00.000Z",
            type = EventType.EXCEPTION,
            userTriggered = false,
            serializedData = null,
            serializedDataFilePath = "missing-file.json",
            serializedAttachments = null,
            serializedAttributes = "{}",
            serializedUserDefinedAttributes = null,
        )

        `when`(fileStorage.getFile("missing-file.json")).thenReturn(null)

        val jsonWriterCaptor = argumentCaptor<(okio.BufferedSink) -> Unit>()
        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            HttpResponse.Success(),
        )

        client.execute("batch123", listOf(event), emptyList())

        verify(httpClient).sendJsonRequest(anyString(), anyString(), any(), jsonWriterCaptor.capture())
        val buffer = Buffer()
        jsonWriterCaptor.firstValue.invoke(buffer)
        val json = buffer.readUtf8()

        assertEquals("{\"events\":[],\"spans\":[]}", json)
        verify(mockLogger).log(
            eq(LogLevel.Error),
            eq("Exporter: event data file missing, skipping event event-1"),
            isNull(),
        )
    }

    @Test
    fun `execute includes events with valid inline data alongside skipped events`() {
        val event1 = EventPacket(
            eventId = "event-1",
            sessionId = "session-1",
            timestamp = "2024-01-01T00:00:00.000Z",
            type = EventType.STRING,
            userTriggered = false,
            serializedData = "{\"key\":\"value\"}",
            serializedDataFilePath = null,
            serializedAttachments = null,
            serializedAttributes = "{}",
            serializedUserDefinedAttributes = null,
        )

        val event2 = EventPacket(
            eventId = "event-2",
            sessionId = "session-1",
            timestamp = "2024-01-01T00:00:01.000Z",
            type = EventType.EXCEPTION,
            userTriggered = false,
            serializedData = null,
            serializedDataFilePath = "missing-file.json",
            serializedAttachments = null,
            serializedAttributes = "{}",
            serializedUserDefinedAttributes = null,
        )

        `when`(fileStorage.getFile("missing-file.json")).thenReturn(null)

        val jsonWriterCaptor = argumentCaptor<(okio.BufferedSink) -> Unit>()
        `when`(httpClient.sendJsonRequest(anyString(), anyString(), any(), any())).thenReturn(
            HttpResponse.Success(),
        )

        networkClient.execute("batch123", listOf(event1, event2), emptyList())

        verify(httpClient).sendJsonRequest(anyString(), anyString(), any(), jsonWriterCaptor.capture())
        val buffer = Buffer()
        jsonWriterCaptor.firstValue.invoke(buffer)
        val json = buffer.readUtf8()

        // event-1 should be present, event-2 should be skipped
        assertTrue(json.contains("\"id\":\"event-1\""))
        assertTrue(!json.contains("\"id\":\"event-2\""))
        // Verify valid JSON structure - no trailing/leading commas
        assertTrue(json.startsWith("{\"events\":[{"))
        assertTrue(json.contains("}],\"spans\":[]}"))
    }
}
