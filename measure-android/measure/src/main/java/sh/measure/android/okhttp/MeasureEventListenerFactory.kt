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
import sh.measure.android.events.EventTracker
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.iso8601Timestamp
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy

@Suppress("unused")
class MeasureEventListenerFactory internal constructor(
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider,
    private val currentThread: CurrentThread,
    private val delegate: EventListener.Factory?,
) : EventListener.Factory {
    constructor(delegate: EventListener.Factory? = null) : this(
        eventTracker = Measure.getEventTracker(),
        timeProvider = Measure.getTimeProvider(),
        currentThread = Measure.getCurrentThread(),
        delegate = delegate,
    )

    override fun create(call: Call): EventListener {
        val delegate = delegate?.create(call)
        return OkHttpEventListener(eventTracker, timeProvider, currentThread, delegate)
    }
}

internal class OkHttpEventListener(
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider,
    private val currentThread: CurrentThread,
    private val delegate: EventListener?,
) : EventListener() {
    internal var url: String? = null
    internal var method: String? = null
    internal var statusCode: Int? = null
    internal var requestBodySize: Long? = null
    internal var responseBodySize: Long? = null
    internal var requestHeadersSize: Long? = null
    internal var responseHeadersSize: Long? = null
    internal var failureReason: String? = null
    internal var failureDescription: String? = null
    internal val timings = mutableMapOf<String, Long>()
    internal var requestTimestamp: String? = null
    internal val requestHeaders: MutableMap<String, String> = mutableMapOf()
    internal val responseHeaders: MutableMap<String, String> = mutableMapOf()
    private var isEventTracked: Boolean = false

    override fun callStart(call: Call) {
        timings[Timing.CALL_START] = timeProvider.uptimeInMillis
        requestTimestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp()
        delegate?.callStart(call)
    }

    override fun dnsStart(call: Call, domainName: String) {
        timings[Timing.DNS_START] = timeProvider.uptimeInMillis
        delegate?.dnsStart(call, domainName)
    }

    override fun dnsEnd(call: Call, domainName: String, inetAddressList: List<InetAddress>) {
        timings[Timing.DNS_END] = timeProvider.uptimeInMillis
        delegate?.dnsEnd(call, domainName, inetAddressList)
    }

    override fun connectStart(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy) {
        timings[Timing.CONNECT_START] = timeProvider.uptimeInMillis
        delegate?.connectStart(call, inetSocketAddress, proxy)
    }

    override fun connectEnd(
        call: Call,
        inetSocketAddress: InetSocketAddress,
        proxy: Proxy,
        protocol: Protocol?,
    ) {
        timings[Timing.CONNECT_END] = timeProvider.uptimeInMillis
        delegate?.connectEnd(call, inetSocketAddress, proxy, protocol)
    }

    override fun connectFailed(
        call: Call,
        inetSocketAddress: InetSocketAddress,
        proxy: Proxy,
        protocol: Protocol?,
        ioe: IOException,
    ) {
        failureReason = ioe.javaClass.name
        failureDescription = ioe.message
        timings[Timing.CONNECT_FAILED] = timeProvider.uptimeInMillis
        trackEvent()
        delegate?.connectFailed(call, inetSocketAddress, proxy, protocol, ioe)
    }

    override fun requestHeadersStart(call: Call) {
        timings[Timing.REQUEST_HEADERS_START] = timeProvider.uptimeInMillis
        delegate?.requestHeadersStart(call)
    }

    override fun requestHeadersEnd(call: Call, request: Request) {
        url = request.url.toString()
        requestHeadersSize = request.headers.byteCount()
        requestHeaders.putAll(request.headers.toMultimap().mapValues { it.value.joinToString() })
        method = request.method
        timings[Timing.REQUEST_HEADERS_END] = timeProvider.uptimeInMillis
        delegate?.requestHeadersEnd(call, request)
    }

    override fun requestBodyStart(call: Call) {
        timings[Timing.REQUEST_BODY_START] = timeProvider.uptimeInMillis
        delegate?.requestBodyStart(call)
    }

    override fun requestBodyEnd(call: Call, byteCount: Long) {
        requestBodySize = byteCount
        timings[Timing.REQUEST_BODY_END] = timeProvider.uptimeInMillis
        delegate?.requestBodyEnd(call, byteCount)
    }

    override fun requestFailed(call: Call, ioe: IOException) {
        failureReason = ioe.javaClass.name
        failureDescription = ioe.message
        timings[Timing.REQUEST_FAILED] = timeProvider.uptimeInMillis
        delegate?.requestFailed(call, ioe)
    }

    override fun responseHeadersStart(call: Call) {
        timings[Timing.RESPONSE_HEADERS_START] = timeProvider.uptimeInMillis
        delegate?.responseHeadersStart(call)
    }

    override fun responseHeadersEnd(call: Call, response: Response) {
        statusCode = response.code
        responseHeadersSize = response.headers.byteCount()
        responseHeaders.putAll(response.headers.toMultimap().mapValues { it.value.joinToString() })
        timings[Timing.RESPONSE_HEADERS_END] = timeProvider.uptimeInMillis
        delegate?.responseHeadersEnd(call, response)
    }

    override fun responseBodyStart(call: Call) {
        timings[Timing.RESPONSE_BODY_START] = timeProvider.uptimeInMillis
        delegate?.responseBodyStart(call)
    }

    override fun responseBodyEnd(call: Call, byteCount: Long) {
        responseBodySize = byteCount
        timings[Timing.RESPONSE_BODY_END] = timeProvider.uptimeInMillis
        delegate?.responseBodyEnd(call, byteCount)
    }

    override fun responseFailed(call: Call, ioe: IOException) {
        failureReason = ioe.javaClass.name
        failureDescription = ioe.message
        timings[Timing.RESPONSE_FAILED] = timeProvider.uptimeInMillis
        trackEvent()
        delegate?.responseFailed(call, ioe)
    }

    override fun callEnd(call: Call) {
        timings[Timing.CALL_END] = timeProvider.uptimeInMillis
        trackEvent()
        delegate?.callEnd(call)
    }

    override fun callFailed(call: Call, ioe: IOException) {
        failureReason = ioe.javaClass.name
        failureDescription = ioe.message
        timings[Timing.CALL_FAILED] = timeProvider.uptimeInMillis
        trackEvent()
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

    private fun trackEvent() {
        val urlValue = url
        val methodValue = method
        if (isEventTracked || !hasCallStartTiming()) {
            return
        }
        if (urlValue == null || methodValue == null) {
            return
        }
        isEventTracked = true
        val currentTimeSinceEpochInMillis = timeProvider.currentTimeSinceEpochInMillis
        val responseTimestamp = currentTimeSinceEpochInMillis.iso8601Timestamp()

        eventTracker.trackHttpEvent(
            HttpEvent(
                url = urlValue,
                method = methodValue.lowercase(),
                status_code = statusCode,
                request_body_size = requestBodySize,
                response_body_size = responseBodySize,
                request_timestamp = requestTimestamp,
                response_timestamp = responseTimestamp,
                request_headers_size = requestHeadersSize,
                response_headers_size = responseHeadersSize,
                failure_reason = failureReason,
                failure_description = failureDescription,
                client = HttpClientName.OK_HTTP,
                timestamp = currentTimeSinceEpochInMillis,
                request_headers = requestHeaders,
                response_headers = responseHeaders,
                start_time = timings[Timing.CALL_START],
                end_time = getEndTime(),
                dns_start = timings[Timing.DNS_START],
                dns_end = timings[Timing.DNS_END],
                connect_start = timings[Timing.CONNECT_START],
                connect_end = timings[Timing.CONNECT_END],
                request_start = timings[Timing.REQUEST_HEADERS_START],
                request_end = timings[Timing.REQUEST_BODY_END]
                    ?: timings[Timing.REQUEST_HEADERS_END],
                request_headers_start = timings[Timing.REQUEST_HEADERS_START],
                request_headers_end = timings[Timing.REQUEST_HEADERS_END],
                request_body_start = timings[Timing.REQUEST_BODY_START],
                request_body_end = timings[Timing.REQUEST_BODY_END],
                response_start = timings[Timing.RESPONSE_HEADERS_START],
                response_end = timings[Timing.RESPONSE_BODY_END],
                response_headers_start = timings[Timing.RESPONSE_HEADERS_START],
                response_headers_end = timings[Timing.RESPONSE_HEADERS_END],
                response_body_start = timings[Timing.RESPONSE_BODY_START],
                response_body_end = timings[Timing.RESPONSE_BODY_END],
                thread_name = currentThread.name,
            ),
        )
    }

    private fun getEndTime() =
        timings[Timing.CALL_END] ?: timings[Timing.CALL_FAILED] ?: timings[Timing.RESPONSE_FAILED]
            ?: timings[Timing.REQUEST_FAILED] ?: timings[Timing.CONNECT_FAILED]

    private fun hasCallStartTiming() = timings[Timing.CALL_START] != null
}

internal object Timing {
    const val CALL_START = "call_start"
    const val DNS_START = "dns_start"
    const val DNS_END = "dns_end"
    const val CONNECT_START = "connect_start"
    const val CONNECT_END = "connect_end"
    const val CONNECT_FAILED = "connect_failed"
    const val REQUEST_HEADERS_START = "request_headers_start"
    const val REQUEST_HEADERS_END = "request_headers_end"
    const val REQUEST_BODY_START = "request_body_start"
    const val REQUEST_BODY_END = "request_body_end"
    const val REQUEST_FAILED = "request_failed"
    const val RESPONSE_HEADERS_START = "response_headers_start"
    const val RESPONSE_HEADERS_END = "response_headers_end"
    const val RESPONSE_BODY_START = "response_body_start"
    const val RESPONSE_BODY_END = "response_body_end"
    const val RESPONSE_FAILED = "response_failed"
    const val CALL_END = "call_end"
    const val CALL_FAILED = "call_failed"
}
