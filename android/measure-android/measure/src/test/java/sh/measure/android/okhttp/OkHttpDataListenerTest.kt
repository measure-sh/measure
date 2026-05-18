package sh.measure.android.okhttp

import okhttp3.Call
import okhttp3.Connection
import okhttp3.EventListener
import okhttp3.Headers
import okhttp3.HttpUrl
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Proxy

internal class OkHttpDataListenerTest {
    private val delegate: EventListener = mock()
    private val signalProcessor: OkHttpEventCollector = mock()

    @Test
    fun `OkHttpEventListener delegates callStart to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.callStart(call)
        verify(delegate).callStart(call)
        verify(signalProcessor).callStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates callEnd to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.callStart(call)
        verify(delegate).callStart(call)
        verify(signalProcessor).callStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates dnsStart to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.dnsStart(call, "")
        verify(delegate).dnsStart(call, "")
        verify(signalProcessor).dnsStart(call, "")
    }

    @Test
    fun `OkHttpEventListener delegates dnsEnd to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.dnsEnd(call, "", listOf())
        verify(delegate).dnsEnd(call, "", listOf())
        verify(signalProcessor).dnsEnd(call, "", listOf())
    }

    @Test
    fun `OkHttpEventListener delegates connectStart to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val inetAddress = mock<InetSocketAddress>()
        val proxy = mock<Proxy>()
        listener.connectStart(call, inetAddress, proxy)
        verify(delegate).connectStart(call, inetAddress, proxy)
        verify(signalProcessor).connectStart(call, inetAddress, proxy)
    }

    @Test
    fun `OkHttpEventListener delegates connectEnd to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val inetAddress = mock<InetSocketAddress>()
        val proxy = mock<Proxy>()
        val protocol = mock<Protocol>()
        listener.connectEnd(call, inetAddress, proxy, protocol)
        verify(delegate).connectEnd(call, inetAddress, proxy, protocol)
        verify(signalProcessor).connectEnd(call, inetAddress, proxy, protocol)
    }

    @Test
    fun `OkHttpEventListener delegates connectFailed to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val inetAddress = mock<InetSocketAddress>()
        val proxy = mock<Proxy>()
        val protocol = mock<Protocol>()
        val exception = mock<IOException>()
        listener.connectFailed(call, inetAddress, proxy, protocol, exception)
        verify(delegate).connectFailed(call, inetAddress, proxy, protocol, exception)
        verify(signalProcessor).connectFailed(call, inetAddress, proxy, protocol, exception)
    }

    @Test
    fun `OkHttpEventListener delegates requestHeadersStart to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.requestHeadersStart(call)
        verify(delegate).requestHeadersStart(call)
        verify(signalProcessor).requestHeadersStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates requestHeadersEnd to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val request = mock<Request>()
        `when`(request.url).thenReturn(httpUrl())
        `when`(request.headers).thenReturn(Headers.headersOf("key", "value"))
        val call = mock<Call>()
        listener.requestHeadersEnd(call, request)
        verify(delegate).requestHeadersEnd(call, request)
        verify(signalProcessor).requestHeadersEnd(call, request)
    }

    @Test
    fun `OkHttpEventListener delegates requestBodyStart to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.requestBodyStart(call)
        verify(delegate).requestBodyStart(call)
        verify(signalProcessor).requestBodyStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates requestBodyEnd to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.requestBodyEnd(call, 1000L)
        verify(delegate).requestBodyEnd(call, 1000L)
        verify(signalProcessor).requestBodyEnd(call, 1000L)
    }

    @Test
    fun `OkHttpEventListener delegates requestFailed to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val exception = mock<IOException>()
        val call = mock<Call>()
        listener.requestFailed(call, exception)
        verify(delegate).requestFailed(call, exception)
        verify(signalProcessor).requestFailed(call, exception)
    }

    @Test
    fun `OkHttpEventListener delegates responseHeadersStart to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.responseHeadersStart(call)
        verify(delegate).responseHeadersStart(call)
        verify(signalProcessor).responseHeadersStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates responseHeadersEnd to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val response = mock<Response>()
        `when`(response.headers).thenReturn(Headers.headersOf("key", "value"))
        val call = mock<Call>()
        listener.responseHeadersEnd(call, response)
        verify(delegate).responseHeadersEnd(call, response)
        verify(signalProcessor).responseHeadersEnd(call, response)
    }

    @Test
    fun `OkHttpEventListener delegates responseBodyStart to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.responseBodyStart(call)
        verify(delegate).responseBodyStart(call)
        verify(signalProcessor).responseBodyStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates responseBodyEnd to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.responseBodyEnd(call, 1000L)
        verify(delegate).responseBodyEnd(call, 1000L)
        verify(signalProcessor).responseBodyEnd(call, 1000L)
    }

    @Test
    fun `OkHttpEventListener delegates responseFailed to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val exception = mock<IOException>()
        val call = mock<Call>()
        listener.responseFailed(call, exception)
        verify(delegate).responseFailed(call, exception)
        verify(signalProcessor).responseFailed(call, exception)
    }

    @Test
    fun `OkHttpEventListener delegates callFailed to delegate and event processor`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val exception = mock<IOException>()
        val call = mock<Call>()
        listener.callFailed(call, exception)
        verify(delegate).callFailed(call, exception)
        verify(signalProcessor).callFailed(call, exception)
    }

    @Test
    fun `OkHttpEventListener delegates canceled to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.canceled(call)
        verify(delegate).canceled(call)
    }

    @Test
    fun `OkHttpEventListener delegates secureConnectStart to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.secureConnectStart(call)
        verify(delegate).secureConnectStart(call)
    }

    @Test
    fun `OkHttpEventListener delegates secureConnectEnd to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.secureConnectEnd(call, null)
        verify(delegate).secureConnectEnd(call, null)
    }

    @Test
    fun `OkHttpEventListener delegates proxySelectStart to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val url = mock<HttpUrl>()
        listener.proxySelectStart(call, url)
        verify(delegate).proxySelectStart(call, url)
    }

    @Test
    fun `OkHttpEventListener delegates proxySelectEnd to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val url = mock<HttpUrl>()
        val proxies = mock<List<@JvmSuppressWildcards Proxy>>()
        listener.proxySelectEnd(call, url, proxies)
        verify(delegate).proxySelectEnd(call, url, proxies)
    }

    @Test
    fun `OkHttpEventListener delegates cacheConditionalHit to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val cachedResponse = mock<Response>()
        listener.cacheConditionalHit(call, cachedResponse)
        verify(delegate).cacheConditionalHit(call, cachedResponse)
    }

    @Test
    fun `OkHttpEventListener delegates cacheHit to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val response = mock<Response>()
        listener.cacheHit(call, response)
        verify(delegate).cacheHit(call, response)
    }

    @Test
    fun `OkHttpEventListener delegates cacheMiss to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        listener.cacheMiss(call)
        verify(delegate).cacheMiss(call)
    }

    @Test
    fun `OkHttpEventListener delegates connectionAcquired to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val connection = mock<Connection>()
        listener.connectionAcquired(call, connection)
        verify(delegate).connectionAcquired(call, connection)
    }

    @Test
    fun `OkHttpEventListener delegates connectionReleased to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val connection = mock<Connection>()
        listener.connectionReleased(call, connection)
        verify(delegate).connectionReleased(call, connection)
    }

    @Test
    fun `OkHttpEventListener delegates satisfactionFailure to delegate`() {
        val listener = OkHttpEventListener(signalProcessor, delegate)
        val call = mock<Call>()
        val response = mock<Response>()
        listener.satisfactionFailure(call, response)
    }

    private fun httpUrl() = HttpUrl.Builder().scheme("https").host("www.measure.sh").build()
}
