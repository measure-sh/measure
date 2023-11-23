package sh.measure.android.okhttp

import okhttp3.HttpUrl
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import sh.measure.android.events.EventTracker
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.iso8601Timestamp
import java.io.IOException

internal class OkHttpEventListenerTest {
    private lateinit var eventTracker: EventTracker
    private lateinit var currentThread: CurrentThread

    @Before
    fun setUp() {
        eventTracker = mock()
        currentThread = CurrentThread()
    }

    @Test
    fun `OkHttpEventListener callStart should set call start time and request timestamp`() {
        val callStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = callStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.callStart(mock())
        assertEquals(listener.timings[Timing.CALL_START], callStartUptime)
        assertEquals(
            listener.requestTimestamp, timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp()
        )
    }

    @Test
    fun `OkHttpEventListener dnsStart should set dns start time`() {
        val dnsStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = dnsStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.dnsStart(mock(), "domainName")
        assertEquals(listener.timings[Timing.DNS_START], dnsStartUptime)
    }

    @Test
    fun `OkHttpEventListener dnsEnd should set dns end time`() {
        val dnsEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = dnsEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.dnsEnd(mock(), "domainName", listOf())
        assertEquals(listener.timings[Timing.DNS_END], dnsEndUptime)
    }

    @Test
    fun `OkHttpEventListener connectStart should set connect start time`() {
        val connectStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = connectStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.connectStart(mock(), mock(), mock())
        assertEquals(listener.timings[Timing.CONNECT_START], connectStartUptime)
    }

    @Test
    fun `OkHttpEventListener connectEnd should set connect end time`() {
        val connectEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = connectEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.connectEnd(mock(), mock(), mock(), mock())
        assertEquals(listener.timings[Timing.CONNECT_END], connectEndUptime)
    }

    @Test
    fun `OkHttpEventListener connectFailed should set connect failed time`() {
        val connectFailedUptime = 10000L
        val exception = IOException("message")
        val timeProvider = FakeTimeProvider(time = connectFailedUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.connectFailed(mock(), mock(), mock(), mock(), exception)
        assertEquals(listener.timings[Timing.CONNECT_FAILED], connectFailedUptime)
        assertEquals(listener.failureReason, exception.javaClass.name)
        assertEquals(listener.failureDescription, exception.message)
    }

    @Test
    fun `OkHttpEventListener callEnd should set call end time`() {
        val callEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = callEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.callEnd(mock())
        assertEquals(listener.timings[Timing.CALL_END], callEndUptime)
    }

    @Test
    fun `OkHttpEventListener callFailed should set call failed time`() {
        val callFailedUptime = 10000L
        val exception = IOException("message")
        val timeProvider = FakeTimeProvider(time = callFailedUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.callFailed(mock(), exception)
        assertEquals(listener.timings[Timing.CALL_FAILED], callFailedUptime)
        assertEquals(listener.failureReason, exception.javaClass.name)
        assertEquals(listener.failureDescription, exception.message)
    }

    @Test
    fun `OkHttpEventListener requestHeadersStart should set request headers start time`() {
        val requestHeadersStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = requestHeadersStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.requestHeadersStart(mock())
        assertEquals(listener.timings[Timing.REQUEST_HEADERS_START], requestHeadersStartUptime)
    }

    @Test
    fun `OkHttpEventListener requestHeadersEnd should set request headers, header size, end time, url and method`() {
        val header = "key" to "value"
        val request = getFakeRequest(header)
        val requestHeadersEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = requestHeadersEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.requestHeadersEnd(mock(), request)
        assertEquals(listener.timings[Timing.REQUEST_HEADERS_END], requestHeadersEndUptime)
        assertEquals(listener.requestHeaders, mapOf(header))
        assertEquals(listener.requestHeadersSize, request.headers.byteCount())
        assertEquals(listener.method, request.method)
        assertEquals(listener.url, request.url.toString())
    }

    @Test
    fun `OkHttpEventListener requestBodyStart should set request body start time`() {
        val requestBodyStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = requestBodyStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.requestBodyStart(mock())
        assertEquals(listener.timings[Timing.REQUEST_BODY_START], requestBodyStartUptime)
    }

    @Test
    fun `OkHttpEventListener requestBodyEnd should set request body end time`() {
        val requestBodyEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = requestBodyEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.requestBodyEnd(mock(), 1000L)
        assertEquals(listener.timings[Timing.REQUEST_BODY_END], requestBodyEndUptime)
        assertEquals(listener.requestBodySize, 1000L)
    }

    @Test
    fun `OkHttpEventListener requestFailed should set request failed time`() {
        val requestFailedUptime = 10000L
        val exception = IOException("message")
        val timeProvider = FakeTimeProvider(time = requestFailedUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.requestFailed(mock(), exception)
        assertEquals(listener.timings[Timing.REQUEST_FAILED], requestFailedUptime)
        assertEquals(listener.failureReason, exception.javaClass.name)
        assertEquals(listener.failureDescription, exception.message)
    }

    @Test
    fun `OkHttpEventListener responseHeadersStart should set response headers start time`() {
        val responseHeadersStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = responseHeadersStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.responseHeadersStart(mock())
        assertEquals(listener.timings[Timing.RESPONSE_HEADERS_START], responseHeadersStartUptime)
    }

    @Test
    fun `OkHttpEventListener responseHeadersEnd should set response headers, header size, status code and end time`() {
        val requestHeader = "key" to "value"
        val request = getFakeRequest(requestHeader)
        val responseHeader = "key" to "value"
        val response =
            Response.Builder().header(responseHeader.first, responseHeader.second).code(200)
                .message("OK").protocol(Protocol.HTTP_1_1).request(request).build()
        val responseHeadersEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = responseHeadersEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.responseHeadersEnd(mock(), response)
        assertEquals(listener.timings[Timing.RESPONSE_HEADERS_END], responseHeadersEndUptime)
        assertEquals(listener.responseHeaders, mapOf(responseHeader))
        assertEquals(listener.responseHeadersSize, response.headers.byteCount())
        assertEquals(listener.statusCode, response.code)
    }

    @Test
    fun `OkHttpEventListener responseBodyStart should set response body start time`() {
        val responseBodyStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = responseBodyStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.responseBodyStart(mock())
        assertEquals(listener.timings[Timing.RESPONSE_BODY_START], responseBodyStartUptime)
    }

    @Test
    fun `OkHttpEventListener responseBodyEnd should set response body end time`() {
        val responseBodyEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = responseBodyEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.responseBodyEnd(mock(), 1000L)
        assertEquals(listener.timings[Timing.RESPONSE_BODY_END], responseBodyEndUptime)
        assertEquals(listener.responseBodySize, 1000L)
    }

    @Test
    fun `OkHttpEventListener responseFailed should set response failed time`() {
        val responseFailedUptime = 10000L
        val exception = IOException("message")
        val timeProvider = FakeTimeProvider(time = responseFailedUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread
        )

        listener.responseFailed(mock(), exception)
        assertEquals(listener.timings[Timing.RESPONSE_FAILED], responseFailedUptime)
        assertEquals(listener.failureReason, exception.javaClass.name)
        assertEquals(listener.failureDescription, exception.message)
    }

    private fun getFakeRequest(header: Pair<String, String>): Request {
        val url = HttpUrl.Builder().scheme("https").host("www.measure.sh").build()
        return Request.Builder().header(header.first, header.second).post("body".toRequestBody())
            .url(url).build()
    }
}
