package sh.measure.android.exporter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.FileStorage

class NetworkClientTest {
    private val fileStorage = mock<FileStorage>()
    private val httpClient = mock<HttpUrlConnectionClient>()
    private val multipartDataFactory = mock<MultipartDataFactory>()
    private val configProvider = FakeConfigProvider()
    private val networkClient: NetworkClient = NetworkClientImpl(
        logger = NoopLogger(),
        fileStorage = fileStorage,
        httpClient = httpClient,
        multipartDataFactory = multipartDataFactory,
        configProvider = configProvider
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
            multipartDataFactory = multipartDataFactory,
            configProvider = configProvider
        )

        clientWithErrorLogger.init(baseUrl = "invalid-url", apiKey = "secret")

        verify(errorLogger).log(eq(LogLevel.Error), eq("Failed to send request: invalid API_URL"), any())
    }

    @Test
    fun `execute sends request with correct URL and headers`() {
        val eventPackets = listOf<EventPacket>()
        val spanPackets = listOf<SpanPacket>()
        val attachmentPackets = listOf<AttachmentPacket>()
        val multipartData = listOf<MultipartData>()

        `when`(multipartDataFactory.createFromEventPacket(any())).thenReturn(null)
        `when`(multipartDataFactory.createFromAttachmentPacket(any())).thenReturn(null)
        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenReturn(
            HttpResponse.Success(),
        )

        networkClient.execute("batch123", eventPackets, attachmentPackets, spanPackets)

        verify(httpClient).sendMultipartRequest(
            eq("http://localhost:8080/events"),
            eq("PUT"),
            eq(
                mapOf("msr-req-id" to "batch123", "Authorization" to "Bearer secret"),
            ),
            eq(multipartData),
        )
    }

    @Test
    fun `execute prepares multipart data correctly`() {
        val eventPacket = mock<EventPacket>()
        val spanPacket = mock<SpanPacket>()
        val attachmentPacket = mock<AttachmentPacket>()
        val eventMultipartData = mock<MultipartData>()
        val spanMultipartData = mock<MultipartData>()
        val attachmentMultipartData = mock<MultipartData>()

        `when`(multipartDataFactory.createFromEventPacket(eventPacket)).thenReturn(
            eventMultipartData,
        )
        `when`(multipartDataFactory.createFromAttachmentPacket(attachmentPacket)).thenReturn(
            attachmentMultipartData,
        )
        `when`(multipartDataFactory.createFromSpanPacket(spanPacket)).thenReturn(
            spanMultipartData,
        )
        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenReturn(
            HttpResponse.Success(),
        )

        networkClient.execute(
            "batch123",
            listOf(eventPacket),
            listOf(attachmentPacket),
            listOf(spanPacket),
        )

        verify(httpClient).sendMultipartRequest(
            any(),
            any(),
            any(),
            eq(listOf(eventMultipartData, attachmentMultipartData, spanMultipartData)),
        )
    }

    @Test
    fun `execute handles successful response`() {
        val successResponse = HttpResponse.Success()
        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenReturn(
            successResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList(), emptyList())

        assertEquals(successResponse, result)
    }

    @Test
    fun `execute handles rate limit error`() {
        val rateLimitResponse = HttpResponse.Error.RateLimitError()
        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenReturn(
            rateLimitResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList(), emptyList())

        assertEquals(rateLimitResponse, result)
    }

    @Test
    fun `execute handles client error`() {
        val clientErrorResponse = HttpResponse.Error.ClientError(400)
        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenReturn(
            clientErrorResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList(), emptyList())

        assertEquals(clientErrorResponse, result)
    }

    @Test
    fun `execute handles server error`() {
        val serverErrorResponse = HttpResponse.Error.ServerError(500)
        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenReturn(
            serverErrorResponse,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList(), emptyList())

        assertEquals(serverErrorResponse, result)
    }

    @Test
    fun `execute handles unknown error`() {
        val exception = RuntimeException("Unknown error")
        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenThrow(
            exception,
        )

        val result = networkClient.execute("batch123", emptyList(), emptyList(), emptyList())

        assert(result is HttpResponse.Error.UnknownError)
        assertEquals(exception, (result as HttpResponse.Error.UnknownError).exception)
    }

    @Test
    fun `execute returns error when network client is not initialized`() {
        val uninitializedNetworkClient = NetworkClientImpl(
            logger = NoopLogger(),
            fileStorage = fileStorage,
            httpClient = httpClient,
            multipartDataFactory = multipartDataFactory,
            configProvider = configProvider
        )

        val result =
            uninitializedNetworkClient.execute("batch123", emptyList(), emptyList(), emptyList())
        assertTrue(result is HttpResponse.Error.UnknownError)
    }

    @Test
    fun `execute with trailing slash in base URL works correctly`() {
        networkClient.init(baseUrl = "http://localhost:8080/", apiKey = "secret")
        val eventPackets = listOf<EventPacket>()
        val spanPackets = listOf<SpanPacket>()
        val attachmentPackets = listOf<AttachmentPacket>()

        `when`(httpClient.sendMultipartRequest(anyString(), anyString(), any(), any())).thenReturn(
            HttpResponse.Success(),
        )

        networkClient.execute("batch123", eventPackets, attachmentPackets, spanPackets)

        verify(httpClient).sendMultipartRequest(
            eq("http://localhost:8080/events"),
            any(),
            any(),
            any(),
        )
    }
}
