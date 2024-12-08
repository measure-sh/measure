package sh.measure.android.okhttp

import okhttp3.Call
import okhttp3.Connection
import okhttp3.EventListener
import okhttp3.Handshake
import okhttp3.HttpUrl
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import sh.measure.android.Measure
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy

@Suppress("unused")
class MeasureEventListenerFactory(
    private val delegate: EventListener.Factory?,
) : EventListener.Factory {

    override fun create(call: Call): EventListener {
        val delegate = delegate?.create(call)
        return OkHttpEventListener(delegate)
    }
}

internal class OkHttpEventListener(
    private val signalProcessor: OkHttpEventCollector?,
    private val delegate: EventListener?,
) : EventListener() {

    constructor(delegate: EventListener?) : this(Measure.getOkHttpEventCollector(), delegate)

    override fun callStart(call: Call) {
        signalProcessor?.callStart(call)
        delegate?.callStart(call)
    }

    override fun dnsStart(call: Call, domainName: String) {
        signalProcessor?.dnsStart(call, domainName)
        delegate?.dnsStart(call, domainName)
    }

    override fun dnsEnd(call: Call, domainName: String, inetAddressList: List<InetAddress>) {
        signalProcessor?.dnsEnd(call, domainName, inetAddressList)
        delegate?.dnsEnd(call, domainName, inetAddressList)
    }

    override fun connectStart(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy) {
        signalProcessor?.connectStart(call, inetSocketAddress, proxy)
        delegate?.connectStart(call, inetSocketAddress, proxy)
    }

    override fun connectEnd(
        call: Call,
        inetSocketAddress: InetSocketAddress,
        proxy: Proxy,
        protocol: Protocol?,
    ) {
        signalProcessor?.connectEnd(call, inetSocketAddress, proxy, protocol)
        delegate?.connectEnd(call, inetSocketAddress, proxy, protocol)
    }

    override fun connectFailed(
        call: Call,
        inetSocketAddress: InetSocketAddress,
        proxy: Proxy,
        protocol: Protocol?,
        ioe: IOException,
    ) {
        signalProcessor?.connectFailed(call, inetSocketAddress, proxy, protocol, ioe)
        delegate?.connectFailed(call, inetSocketAddress, proxy, protocol, ioe)
    }

    override fun requestHeadersStart(call: Call) {
        signalProcessor?.requestHeadersStart(call)
        delegate?.requestHeadersStart(call)
    }

    override fun requestHeadersEnd(call: Call, request: Request) {
        signalProcessor?.requestHeadersEnd(call, request)
        delegate?.requestHeadersEnd(call, request)
    }

    override fun requestBodyStart(call: Call) {
        signalProcessor?.requestBodyStart(call)
        delegate?.requestBodyStart(call)
    }

    override fun requestBodyEnd(call: Call, byteCount: Long) {
        signalProcessor?.requestBodyEnd(call, byteCount)
        delegate?.requestBodyEnd(call, byteCount)
    }

    override fun requestFailed(call: Call, ioe: IOException) {
        signalProcessor?.requestFailed(call, ioe)
        delegate?.requestFailed(call, ioe)
    }

    override fun responseHeadersStart(call: Call) {
        signalProcessor?.responseHeadersStart(call)
        delegate?.responseHeadersStart(call)
    }

    override fun responseHeadersEnd(call: Call, response: Response) {
        signalProcessor?.responseHeadersEnd(call, response)
        delegate?.responseHeadersEnd(call, response)
    }

    override fun responseBodyStart(call: Call) {
        signalProcessor?.responseBodyStart(call)
        delegate?.responseBodyStart(call)
    }

    override fun responseBodyEnd(call: Call, byteCount: Long) {
        signalProcessor?.responseBodyEnd(call, byteCount)
        delegate?.responseBodyEnd(call, byteCount)
    }

    override fun responseFailed(call: Call, ioe: IOException) {
        signalProcessor?.responseFailed(call, ioe)
        delegate?.responseFailed(call, ioe)
    }

    override fun callEnd(call: Call) {
        signalProcessor?.callEnd(call)
        delegate?.callEnd(call)
    }

    override fun callFailed(call: Call, ioe: IOException) {
        signalProcessor?.callFailed(call, ioe)
        delegate?.callFailed(call, ioe)
    }

    override fun cacheConditionalHit(call: Call, cachedResponse: Response) {
        delegate?.cacheConditionalHit(call, cachedResponse)
    }

    override fun cacheHit(call: Call, response: Response) {
        delegate?.cacheHit(call, response)
    }

    override fun cacheMiss(call: Call) {
        delegate?.cacheMiss(call)
    }

    override fun canceled(call: Call) {
        delegate?.canceled(call)
    }

    override fun connectionAcquired(call: Call, connection: Connection) {
        delegate?.connectionAcquired(call, connection)
    }

    override fun connectionReleased(call: Call, connection: Connection) {
        delegate?.connectionReleased(call, connection)
    }

    override fun proxySelectEnd(call: Call, url: HttpUrl, proxies: List<Proxy>) {
        delegate?.proxySelectEnd(call, url, proxies)
    }

    override fun proxySelectStart(call: Call, url: HttpUrl) {
        delegate?.proxySelectStart(call, url)
    }

    override fun satisfactionFailure(call: Call, response: Response) {
        delegate?.satisfactionFailure(call, response)
    }

    override fun secureConnectEnd(call: Call, handshake: Handshake?) {
        delegate?.secureConnectEnd(call, handshake)
    }

    override fun secureConnectStart(call: Call) {
        delegate?.secureConnectStart(call)
    }
}
