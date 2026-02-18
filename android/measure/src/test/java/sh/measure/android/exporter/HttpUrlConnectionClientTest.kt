package sh.measure.android.exporter

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import sh.measure.android.fakes.NoopLogger

class HttpUrlConnectionClientTest {
    private val mockWebServer: MockWebServer = MockWebServer()
    private val client: HttpUrlConnectionClient = HttpUrlConnectionClient(NoopLogger())

    @Before
    fun setup() {
        mockWebServer.start()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `test successful json request`() {
        // given
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        // when
        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            mapOf("Authorization" to "Bearer token"),
        ) { sink ->
            sink.writeUtf8("""{"events":[],"spans":[]}""")
        }

        // then
        val request = mockWebServer.takeRequest()
        assertEquals("PUT", request.method)
        assertEquals("application/json", request.headers["Content-Type"])
        assertEquals("Bearer token", request.headers["Authorization"])
        val body = request.body.readUtf8()
        assertEquals("""{"events":[],"spans":[]}""", body)
        assertTrue(result is HttpResponse.Success)
    }

    @Test
    fun `test successful response with body`() {
        // given
        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody("expected-body"))

        // when
        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        // then
        assertEquals(HttpResponse.Success(body = "expected-body"), result)
    }

    @Test
    fun `test rate limit error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(429))

        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        assertEquals(HttpResponse.Error.RateLimitError(), result)
    }

    @Test
    fun `test rate limit error with body`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(429).setBody("error-body"))

        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        assertEquals(HttpResponse.Error.RateLimitError("error-body"), result)
    }

    @Test
    fun `test client error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(400))

        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        assertEquals(HttpResponse.Error.ClientError(400), result)
    }

    @Test
    fun `test client error with body`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(400).setBody("error-body"))

        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        assertEquals(HttpResponse.Error.ClientError(400, "error-body"), result)
    }

    @Test
    fun `test server error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500))

        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        assertEquals(HttpResponse.Error.ServerError(500), result)
    }

    @Test
    fun `test server error with body`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500).setBody("error-body"))

        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        assertEquals(HttpResponse.Error.ServerError(500, "error-body"), result)
    }

    @Test
    fun `test unknown error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(600))

        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("{}")
        }

        assertTrue(result is HttpResponse.Error.UnknownError)
    }

    @Test
    fun `test streaming json data with multiple writes`() {
        // given
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        // when
        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            // Stream data in chunks
            sink.writeUtf8("""{"events":[""")
            sink.writeUtf8("""{"id":"1","type":"test"}""")
            sink.writeUtf8("""],"spans":[]}""")
        }

        // then
        val request = mockWebServer.takeRequest()
        val body = request.body.readUtf8()
        assertEquals("""{"events":[{"id":"1","type":"test"}],"spans":[]}""", body)
        assertTrue(result is HttpResponse.Success)
    }

    @Test
    fun `test redirection (307 response) with PUT request`() {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(307)
                .addHeader("Location", "/redirected"),
        )
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("Redirected successfully"),
        )

        // When
        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("""{"key":"value"}""")
        }

        // Then
        assertTrue(result is HttpResponse.Success)
        assertEquals(2, mockWebServer.requestCount)

        val originalRequest = mockWebServer.takeRequest()
        assertEquals("PUT", originalRequest.method)
        assertEquals("/", originalRequest.path)

        val redirectedRequest = mockWebServer.takeRequest()
        assertEquals("PUT", redirectedRequest.method)
        assertEquals("/redirected", redirectedRequest.path)

        val redirectedBody = redirectedRequest.body.readUtf8()
        assertEquals("""{"key":"value"}""", redirectedBody)
    }

    @Test
    fun `test redirection (308 response) with PUT request`() {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(308)
                .addHeader("Location", "/redirected"),
        )
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("Redirected successfully"),
        )

        // When
        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("""{"key":"value"}""")
        }

        // Then
        assertTrue(result is HttpResponse.Success)
        assertEquals(2, mockWebServer.requestCount)
    }

    @Test
    fun `test no redirection (302 response) for PUT request`() {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(302)
                .addHeader("Location", "/redirected"),
        )

        // When
        val result = client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("""{"key":"value"}""")
        }

        // Then
        assertTrue(result is HttpResponse.Error.UnknownError)
        assertEquals(1, mockWebServer.requestCount)
    }

    @Test
    fun `test content type is application json`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        client.sendJsonRequest(
            mockWebServer.url("/").toString(),
            "PUT",
            emptyMap(),
        ) { sink ->
            sink.writeUtf8("""{"test":"data"}""")
        }

        val request = mockWebServer.takeRequest()
        assertEquals("application/json", request.headers["Content-Type"])
    }

    @Test
    fun `test successful file upload`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        val result = client.uploadFile(
            url = mockWebServer.url("/").toString(),
            contentType = "image/png",
            fileSize = 12L,
            headers = mapOf(),
            contentEncoding = null,
        ) { sink ->
            sink.writeUtf8("file-content")
        }

        val request = mockWebServer.takeRequest()
        assertEquals("PUT", request.method)
        assertEquals("image/png", request.headers["Content-Type"])
        assertEquals("file-content", request.body.readUtf8())
        assertTrue(result is HttpResponse.Success)
    }

    @Test
    fun `test file upload with zero file size uses chunked streaming`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        val result = client.uploadFile(
            url = mockWebServer.url("/").toString(),
            contentType = "text/plain",
            fileSize = 0L,
            headers = mapOf(),
            contentEncoding = null,
        ) { sink ->
            sink.writeUtf8("test")
        }

        assertTrue(result is HttpResponse.Success)
    }

    @Test
    fun `test file upload failure returns error response`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500))

        val result = client.uploadFile(
            url = mockWebServer.url("/").toString(),
            contentType = "image/jpeg",
            fileSize = 10L,
            headers = mapOf(),
            contentEncoding = null,
        ) { sink ->
            sink.writeUtf8("test-image")
        }

        assertTrue(result is HttpResponse.Error.ServerError)
        assertEquals(500, (result as HttpResponse.Error.ServerError).code)
    }

    @Test
    fun `test file upload with client error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(400))

        val result = client.uploadFile(
            url = mockWebServer.url("/").toString(),
            contentType = "application/pdf",
            fileSize = 4L,
            headers = mapOf(),
            contentEncoding = null,
        ) { sink ->
            sink.writeUtf8("test")
        }

        assertTrue(result is HttpResponse.Error.ClientError)
        assertEquals(400, (result as HttpResponse.Error.ClientError).code)
    }
}
