package sh.measure.android.exporter

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import sh.measure.android.fakes.NoopLogger
import java.io.ByteArrayInputStream
import java.io.InputStream

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
    fun `test successful multipart request`() {
        // given
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        // when
        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            mapOf("Authorization" to "Bearer token"),
            listOf(MultipartData.FormField("key", "value")),
        )

        // then
        val request = mockWebServer.takeRequest()
        assertEquals("POST", request.method)
        assertTrue(request.headers["Content-Type"]?.startsWith("multipart/form-data; boundary=") == true)
        assertEquals("Bearer token", request.headers["Authorization"])
        val body = request.body.readUtf8()
        assertTrue(body.contains("Content-Disposition: form-data; name=\"key\""))
        assertTrue(body.contains("value"))
        assertTrue(result is HttpResponse.Success)
    }

    @Test
    fun `test successful response with body`() {
        // given
        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody("expected-body"))

        // when
        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        // then
        assertEquals(HttpResponse.Success(body = "expected-body"), result)
    }

    @Test
    fun `test rate limit error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(429))

        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        assertEquals(HttpResponse.Error.RateLimitError(), result)
    }

    @Test
    fun `test rate limit error with body`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(429).setBody("error-body"))

        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        assertEquals(HttpResponse.Error.RateLimitError("error-body"), result)
    }

    @Test
    fun `test client error for all 3 retries`() {
        repeat(4) {//1(initial Failure) + 3(retry failure)
            mockWebServer.enqueue(MockResponse().setResponseCode(400))
        }

        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        assertEquals(HttpResponse.Error.ClientError(400), result)
    }

    @Test
    fun `test success in retry after client error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(400))//Simulate Failure
        mockWebServer.enqueue(MockResponse().setResponseCode(200))//Simulate Success
    }

    @Test
    fun `test client error with body for all 3 retries`() {
        repeat(4) {
            mockWebServer.enqueue(MockResponse().setResponseCode(400).setBody("error-body"))
        }

        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        assertEquals(HttpResponse.Error.ClientError(400, "error-body"), result)
    }

    @Test
    fun `test server error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500))

        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        assertEquals(HttpResponse.Error.ServerError(500), result)
    }

    @Test
    fun `test server error with body`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(500).setBody("error-body"))

        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        assertEquals(HttpResponse.Error.ServerError(500, "error-body"), result)
    }

    @Test
    fun `test unknown error`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(600))

        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            emptyList(),
        )

        assertTrue(result is HttpResponse.Error.UnknownError)
    }

    @Test
    fun `test file upload`() {
        // given
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        val inputStream: InputStream = ByteArrayInputStream("file content".toByteArray())

        // when
        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            listOf(MultipartData.FileData("file", "test.txt", inputStream)),
        )

        // then
        val request = mockWebServer.takeRequest()
        val body = request.body.readUtf8()
        assertTrue(body.contains("Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\""))
        assertTrue(body.contains("file content"))
        assertTrue(result is HttpResponse.Success)
    }

    @Test
    fun `test multiple form fields and file upload`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        val inputStream: InputStream = ByteArrayInputStream("file content".toByteArray())
        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            listOf(
                MultipartData.FormField("key1", "value1"),
                MultipartData.FormField("key2", "value2"),
                MultipartData.FileData("file", "test.txt", inputStream),
            ),
        )

        val request = mockWebServer.takeRequest()
        val body = request.body.readUtf8()
        assertTrue(body.contains("Content-Disposition: form-data; name=\"key1\""))
        assertTrue(body.contains("value1"))
        assertTrue(body.contains("Content-Disposition: form-data; name=\"key2\""))
        assertTrue(body.contains("value2"))
        assertTrue(body.contains("Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\""))
        assertTrue(body.contains("file content"))
        assertTrue(result is HttpResponse.Success)
    }

    @Test
    fun `test redirection (307 response) with POST request`() {
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
        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            listOf(MultipartData.FormField("key", "value")),
        )

        // Then
        assertTrue(result is HttpResponse.Success)
        assertEquals(2, mockWebServer.requestCount)

        val originalRequest = mockWebServer.takeRequest()
        assertEquals("POST", originalRequest.method)
        assertEquals("/", originalRequest.path)

        val redirectedRequest = mockWebServer.takeRequest()
        assertEquals("POST", redirectedRequest.method)
        assertEquals("/redirected", redirectedRequest.path)

        val redirectedBody = redirectedRequest.body.readUtf8()
        assertTrue(redirectedBody.contains("Content-Disposition: form-data; name=\"key\""))
        assertTrue(redirectedBody.contains("value"))
    }

    @Test
    fun `test no redirection (302 response) for POST request`() {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(302)
                .addHeader("Location", "/redirected"),
        )

        // When
        val result = client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            listOf(MultipartData.FormField("key", "value")),
        )

        // Then
        assertTrue(result is HttpResponse.Error.UnknownError)
        assertEquals(1, mockWebServer.requestCount)
    }

    @Test
    fun `test boundaries and parts are added correctly to the request`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))

        val inputStream: InputStream = ByteArrayInputStream("file content".toByteArray())
        client.sendMultipartRequest(
            mockWebServer.url("/").toString(),
            "POST",
            emptyMap(),
            listOf(
                MultipartData.FormField("key1", "value1"),
                MultipartData.FileData("file", "test.txt", inputStream),
            ),
        )

        val request = mockWebServer.takeRequest()
        val body = request.body.readUtf8()

        // Extract the boundary from the Content-Type header
        val contentType = request.headers["Content-Type"] ?: ""
        val boundary = contentType.substringAfter("boundary=")

        // Check if the boundary is present in the Content-Type header
        assertTrue(contentType.startsWith("multipart/form-data; boundary="))

        // Check if the body starts and ends with the correct boundary
        assertTrue(body.startsWith("--$boundary\r\n"))
        assertTrue(body.endsWith("--$boundary--\r\n"))

        // Check if parts are separated by the boundary
        val parts = body.split("--$boundary\r\n")
        assertEquals(3, parts.size) // 2 parts + 1 closing boundary

        // Check each part for correct format
        assertTrue(parts[1].contains("Content-Disposition: form-data; name=\"key1\""))
        assertTrue(parts[1].contains("value1"))

        assertTrue(parts[2].contains("Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\""))
        assertTrue(parts[2].contains("file content"))
    }
}
