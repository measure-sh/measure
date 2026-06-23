package sh.measure.android.httpurl

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.okhttp.HttpClientName
import sh.measure.android.okhttp.HttpData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

class HttpUrlConnectionEventCollectorTest {
    private val logger = NoopLogger()
    private val signalProcessor = mock<SignalProcessor>()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider = FakeConfigProvider()
    private val collector = HttpUrlConnectionEventCollectorImpl(
        logger,
        signalProcessor,
        timeProvider,
        configProvider,
    ).also { it.register() }

    private val server = MockWebServer()

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun jsonResponse(code: Int, body: String): MockResponse = MockResponse().setResponseCode(code).setBody(body)
        .addHeader("Content-Type", "application/json")

    private fun open(path: String = "/"): HttpURLConnection {
        val url = URL(server.url(path).toString())
        val raw = url.openConnection() as HttpURLConnection
        val recorder = collector.newRecorder(raw.url.toString())
        return if (raw is javax.net.ssl.HttpsURLConnection) {
            MsrHttpsURLConnection(raw, recorder)
        } else {
            MsrHttpURLConnection(raw, recorder)
        }
    }

    private fun verifyTracked(): HttpData {
        val captor = argumentCaptor<HttpData>()
        verify(signalProcessor, times(1)).track(
            data = captor.capture(),
            timestamp = any(),
            type = eq(EventType.HTTP),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = any(),
            isSampled = any(),
        )
        return captor.firstValue
    }

    private fun verifyNotTracked() {
        verify(signalProcessor, never()).track(
            data = any<HttpData>(),
            timestamp = any(),
            type = any(),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = any(),
            isSampled = any(),
        )
    }

    @Test
    fun `captures method url status timings client and ships event on stream close`() {
        server.enqueue(jsonResponse(200, "ok"))

        val conn = open("/path")
        conn.responseCode
        conn.inputStream.use { it.readBytes() }

        val data = verifyTracked()
        assertEquals("get", data.method)
        assertEquals(server.url("/path").toString(), data.url)
        assertEquals(200, data.status_code)
        assertEquals(HttpClientName.HTTP_URL_CONNECTION, data.client)
        assertEquals("ok", data.response_body)
    }

    @Test
    fun `captures request body when POST`() {
        server.enqueue(jsonResponse(201, "created"))

        val conn = open("/post")
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { os: OutputStream ->
            os.write("hello".toByteArray())
        }
        conn.inputStream.use { it.readBytes() }

        val data = verifyTracked()
        assertEquals("post", data.method)
        assertEquals("hello", data.request_body)
        assertEquals("created", data.response_body)
    }

    @Test
    fun `captures status and error body on 4xx`() {
        server.enqueue(jsonResponse(404, "not found"))

        val conn = open("/missing")
        conn.responseCode
        try {
            conn.inputStream.use { it.readBytes() }
        } catch (_: Exception) {
            // expected — getInputStream throws on 4xx
        }
        conn.errorStream?.use { it.readBytes() }

        val data = verifyTracked()
        assertEquals(404, data.status_code)
        assertEquals("not found", data.response_body)
    }

    @Test
    fun `does not track when shouldTrackHttpEvent returns false`() {
        configProvider.shouldTrackHttpEventForUrl = false
        server.enqueue(MockResponse().setResponseCode(200).setBody("ignored"))

        val conn = open("/blocked")
        conn.responseCode
        conn.inputStream.use { it.readBytes() }

        verifyNotTracked()
    }

    @Test
    fun `does not track when collector is unregistered`() {
        collector.unregister()
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        val conn = open("/x")
        conn.responseCode
        conn.inputStream.use { it.readBytes() }

        verifyNotTracked()
    }

    @Test
    fun `request body capture disabled by config`() {
        configProvider.shouldTrackHttpRequestBodyResult = false
        server.enqueue(jsonResponse(200, "ok"))

        val conn = open("/post")
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write("body".toByteArray()) }
        conn.inputStream.use { it.readBytes() }

        val data = verifyTracked()
        assertNull(data.request_body)
    }

    @Test
    fun `response body capture disabled by config`() {
        configProvider.shouldTrackHttpResponseBodyResult = false
        server.enqueue(jsonResponse(200, "hidden"))

        val conn = open("/x")
        conn.responseCode
        conn.inputStream.use { it.readBytes() }

        val data = verifyTracked()
        assertNull(data.response_body)
    }

    @Test
    fun `does not capture request body when content type is not json`() {
        server.enqueue(jsonResponse(200, "ok"))

        val conn = open("/post")
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/octet-stream")
        conn.outputStream.use { it.write("hello".toByteArray()) }
        conn.inputStream.use { it.readBytes() }

        val data = verifyTracked()
        assertNull(data.request_body)
    }

    @Test
    fun `does not capture response body when content type is not json`() {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody("binary")
                .addHeader("Content-Type", "image/png"),
        )

        val conn = open("/x")
        conn.responseCode
        conn.inputStream.use { it.readBytes() }

        val data = verifyTracked()
        assertNull(data.response_body)
    }

    @Test
    fun `ships only once even after multiple terminal calls`() {
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        val conn = open("/x")
        conn.responseCode
        conn.inputStream.use { it.readBytes() }
        conn.disconnect()

        verifyTracked() // times(1) inside
    }

    @Test
    fun `truncates oversized response body and appends marker`() {
        val big = ByteArray((MAX_BODY_SIZE_BYTES + 10).toInt()) { 'a'.code.toByte() }
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(okio.Buffer().write(big))
                .addHeader("Content-Type", "application/json"),
        )

        val conn = open("/big")
        conn.responseCode
        conn.inputStream.use { it.readBytes() }

        val data = verifyTracked()
        val body = data.response_body!!
        assertTrue(body.endsWith(BODY_TRUNCATED_MESSAGE))
    }
}
