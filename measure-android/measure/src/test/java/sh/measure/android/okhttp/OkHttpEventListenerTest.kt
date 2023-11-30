package sh.measure.android.okhttp

import okhttp3.Call
import okhttp3.Connection
import okhttp3.EventListener
import okhttp3.Headers
import okhttp3.HttpUrl
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.events.EventTracker
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.iso8601Timestamp
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Proxy

internal class OkHttpEventListenerTest {
    private lateinit var eventTracker: EventTracker
    private lateinit var currentThread: CurrentThread
    private lateinit var delegate: EventListener

    @Before
    fun setUp() {
        eventTracker = mock()
        eventTracker = mock()
        currentThread = CurrentThread()
        delegate = mock()
    }

    @Test
    fun `OkHttpEventListener callStart should set call start time and request timestamp`() {
        val callStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = callStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
        )

        listener.dnsStart(mock(), "domainName")
        assertEquals(listener.timings[Timing.DNS_START], dnsStartUptime)
    }

    @Test
    fun `OkHttpEventListener dnsEnd should set dns end time`() {
        val dnsEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = dnsEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread, delegate
        )

        listener.dnsEnd(mock(), "domainName", listOf())
        assertEquals(listener.timings[Timing.DNS_END], dnsEndUptime)
    }

    @Test
    fun `OkHttpEventListener connectStart should set connect start time`() {
        val connectStartUptime = 10000L
        val timeProvider = FakeTimeProvider(time = connectStartUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread, delegate
        )

        listener.connectStart(mock(), mock(), mock())
        assertEquals(listener.timings[Timing.CONNECT_START], connectStartUptime)
    }

    @Test
    fun `OkHttpEventListener connectEnd should set connect end time`() {
        val connectEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = connectEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
        )

        listener.requestBodyStart(mock())
        assertEquals(listener.timings[Timing.REQUEST_BODY_START], requestBodyStartUptime)
    }

    @Test
    fun `OkHttpEventListener requestBodyEnd should set request body end time`() {
        val requestBodyEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = requestBodyEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
        )

        listener.responseBodyStart(mock())
        assertEquals(listener.timings[Timing.RESPONSE_BODY_START], responseBodyStartUptime)
    }

    @Test
    fun `OkHttpEventListener responseBodyEnd should set response body end time`() {
        val responseBodyEndUptime = 10000L
        val timeProvider = FakeTimeProvider(time = responseBodyEndUptime)
        val listener = OkHttpEventListener(
            eventTracker, timeProvider, currentThread, delegate
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
            eventTracker, timeProvider, currentThread, delegate
        )

        listener.responseFailed(mock(), exception)
        assertEquals(listener.timings[Timing.RESPONSE_FAILED], responseFailedUptime)
        assertEquals(listener.failureReason, exception.javaClass.name)
        assertEquals(listener.failureDescription, exception.message)
    }

    @Test
    fun `OkHttpEventListener delegates callStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.callStart(call)
        verify(delegate).callStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates callEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.callStart(call)
        verify(delegate).callStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates dnsStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.dnsStart(call, "")
        verify(delegate).dnsStart(call, "")
    }

    @Test
    fun `OkHttpEventListener delegates dnsEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.dnsEnd(call, "", listOf())
        verify(delegate).dnsEnd(call, "", listOf())
    }

    @Test
    fun `OkHttpEventListener delegates connectStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val inetAddress = mock<InetSocketAddress>()
        val proxy = mock<Proxy>()
        listener.connectStart(call, inetAddress, proxy)
        verify(delegate).connectStart(call, inetAddress, proxy)
    }

    @Test
    fun `OkHttpEventListener delegates connectEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val inetAddress = mock<InetSocketAddress>()
        val proxy = mock<Proxy>()
        val protocol = mock<Protocol>()
        listener.connectEnd(call, inetAddress, proxy, protocol)
        verify(delegate).connectEnd(call, inetAddress, proxy, protocol)
    }

    @Test
    fun `OkHttpEventListener delegates connectFailed to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val inetAddress = mock<InetSocketAddress>()
        val proxy = mock<Proxy>()
        val protocol = mock<Protocol>()
        val exception = mock<IOException>()
        listener.connectFailed(call, inetAddress, proxy, protocol, exception)
        verify(delegate).connectFailed(call, inetAddress, proxy, protocol, exception)
    }

    @Test
    fun `OkHttpEventListener delegates requestHeadersStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.requestHeadersStart(call)
        verify(delegate).requestHeadersStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates requestHeadersEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val request = mock<Request>()
        `when`(request.url).thenReturn(httpUrl())
        `when`(request.headers).thenReturn(Headers.headersOf("key", "value"))
        val call = mock<Call>()
        listener.requestHeadersEnd(call, request)
        verify(delegate).requestHeadersEnd(call, request)
    }

    @Test
    fun `OkHttpEventListener delegates requestBodyStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.requestBodyStart(call)
        verify(delegate).requestBodyStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates requestBodyEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.requestBodyEnd(call, 1000L)
        verify(delegate).requestBodyEnd(call, 1000L)
    }

    @Test
    fun `OkHttpEventListener delegates requestFailed to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val exception = mock<IOException>()
        val call = mock<Call>()
        listener.requestFailed(call, exception)
        verify(delegate).requestFailed(call, exception)
    }

    @Test
    fun `OkHttpEventListener delegates responseHeadersStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.responseHeadersStart(call)
        verify(delegate).responseHeadersStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates responseHeadersEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val response = mock<Response>()
        `when`(response.headers).thenReturn(Headers.headersOf("key", "value"))
        val call = mock<Call>()
        listener.responseHeadersEnd(call, response)
        verify(delegate).responseHeadersEnd(call, response)
    }

    @Test
    fun `OkHttpEventListener delegates responseBodyStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.responseBodyStart(call)
        verify(delegate).responseBodyStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates responseBodyEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.responseBodyEnd(call, 1000L)
        verify(delegate).responseBodyEnd(call, 1000L)
    }

    @Test
    fun `OkHttpEventListener delegates responseFailed to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val exception = mock<IOException>()
        val call = mock<Call>()
        listener.responseFailed(call, exception)
        verify(delegate).responseFailed(call, exception)
    }

    @Test
    fun `OkHttpEventListener delegates callFailed to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val exception = mock<IOException>()
        val call = mock<Call>()
        listener.callFailed(call, exception)
        verify(delegate).callFailed(call, exception)
    }

    @Test
    fun `OkHttpEventListener delegates canceled to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.canceled(call)
        verify(delegate).canceled(call)
    }

    @Test
    fun `OkHttpEventListener delegates secureConnectStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.secureConnectStart(call)
        verify(delegate).secureConnectStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates secureConnectEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.secureConnectEnd(call, null)
        verify(delegate).secureConnectEnd(call, null)
    }

    @Test
    fun `OkHttpEventListener delegates proxySelectStart to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val url = mock<HttpUrl>()
        listener.proxySelectStart(call, url)
        verify(delegate).proxySelectStart(call, url)
    }

    @Test
    fun `OkHttpEventListener delegates proxySelectEnd to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val url = mock<HttpUrl>()
        val proxies = mock<List<@JvmSuppressWildcards Proxy>>()
        listener.proxySelectEnd(call, url, proxies)
        verify(delegate).proxySelectEnd(call, url, proxies)
    }

    @Test
    fun `OkHttpEventListener delegates cacheConditionalHit to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val cachedResponse = mock<Response>()
        listener.cacheConditionalHit(call, cachedResponse)
        verify(delegate).cacheConditionalHit(call, cachedResponse)
    }

    @Test
    fun `OkHttpEventListener delegates cacheHit to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val response = mock<Response>()
        listener.cacheHit(call, response)
        verify(delegate).cacheHit(call, response)
    }

    @Test
    fun `OkHttpEventListener delegates cacheMiss to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        listener.cacheMiss(call)
        verify(delegate).cacheMiss(call)
    }

    @Test
    fun `OkHttpEventListener delegates connectionAcquired to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val connection = mock<Connection>()
        listener.connectionAcquired(call, connection)
        verify(delegate).connectionAcquired(call, connection)
    }

    @Test
    fun `OkHttpEventListener delegates connectionReleased to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val connection = mock<Connection>()
        listener.connectionReleased(call, connection)
        verify(delegate).connectionReleased(call, connection)
    }

    @Test
    fun `OkHttpEventListener delegates satisfactionFailure to delegate`() {
        val listener = OkHttpEventListener(
            eventTracker, FakeTimeProvider(), currentThread, delegate
        )
        val call = mock<Call>()
        val response = mock<Response>()
        listener.satisfactionFailure(call, response)
        verify(delegate).satisfactionFailure(call, response)
    }

    private fun getFakeRequest(header: Pair<String, String>): Request {
        val url = httpUrl()
        return Request.Builder().header(header.first, header.second).post("body".toRequestBody())
            .url(url).build()
    }

    private fun httpUrl() = HttpUrl.Builder().scheme("https").host("www.measure.sh").build()
}
