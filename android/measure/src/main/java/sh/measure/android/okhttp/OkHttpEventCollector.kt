package sh.measure.android.okhttp

import okhttp3.Call
import okhttp3.EventListener
import okhttp3.Handshake
import okhttp3.Request
import okhttp3.Response
import okio.Buffer
import okio.ByteString
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider
import java.io.IOException
import java.io.InterruptedIOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicBoolean

internal abstract class OkHttpEventCollector :
    EventListener(),
    HttpEventCollector {
    open fun request(call: Call, request: Request) {}
    open fun response(call: Call, request: Request, response: Response) {}
}

internal class OkHttpEventCollectorImpl(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) : OkHttpEventCollector() {
    private val enabled = AtomicBoolean(false)
    private val httpDataBuilders: MutableMap<String, HttpData.Builder> by lazy(
        LazyThreadSafetyMode.NONE,
    ) { mutableMapOf() }

    companion object {
        private const val MAX_BODY_SIZE_BYTES = 256 * 1024L
        private const val BODY_TRUNCATED_MESSAGE = "\n... [Body truncated - exceeded 256KB limit]"
    }

    override fun register() {
        enabled.compareAndSet(false, true)
    }

    override fun unregister() {
        enabled.compareAndSet(true, false)
    }

    override fun callStart(call: Call) {
        if (!enabled.get()) return
        val key = getIdentityHash(call)
        val request = call.request()
        val url = request.url.toString()
        if (configProvider.shouldTrackHttpEvent(url)) {
            httpDataBuilders[key] =
                HttpData.Builder().url(url).startTime(timeProvider.elapsedRealtime)
                    .method(request.method.lowercase())
                    .client(HttpClientName.OK_HTTP)
        }
    }

    override fun dnsStart(call: Call, domainName: String) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.dnsStartTime = timeProvider.elapsedRealtime
    }

    override fun dnsEnd(call: Call, domainName: String, inetAddressList: List<InetAddress>) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.dnsStartTime?.let { startTime ->
            builder.dnsDurationMs(timeProvider.elapsedRealtime - startTime)
        }
    }

    override fun connectStart(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.connectStartTime = timeProvider.elapsedRealtime
    }

    override fun connectEnd(
        call: Call,
        inetSocketAddress: InetSocketAddress,
        proxy: Proxy,
        protocol: okhttp3.Protocol?,
    ) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.connectStartTime?.let { startTime ->
            builder.connectTimeMs(timeProvider.elapsedRealtime - startTime)
        }
    }

    override fun connectFailed(
        call: Call,
        inetSocketAddress: InetSocketAddress,
        proxy: Proxy,
        protocol: okhttp3.Protocol?,
        ioe: IOException,
    ) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.connectStartTime = null
        if (isTimeout(ioe)) {
            builder?.isTimeout(true)
        }
    }

    override fun secureConnectStart(call: Call) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.secureConnectStartTime = timeProvider.elapsedRealtime
    }

    override fun secureConnectEnd(call: Call, handshake: Handshake?) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.secureConnectStartTime?.let { startTime ->
            builder.tlsTimeMs(timeProvider.elapsedRealtime - startTime)
        }
    }

    override fun requestHeadersStart(call: Call) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.requestStartTime = timeProvider.elapsedRealtime
    }

    override fun requestHeadersEnd(call: Call, request: Request) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.requestHeadersEndTime = timeProvider.elapsedRealtime
        if (configProvider.shouldTrackHttpRequestBody(request.url.toString())) {
            val filteredHeaders = request.headers.names()
                .filter { headerName ->
                    configProvider.shouldTrackHttpHeader(headerName)
                }
                .associateWith { headerName ->
                    request.headers.values(headerName).joinToString()
                }

            httpDataBuilders[key]?.requestHeaders(filteredHeaders)
        }
    }

    override fun requestBodyEnd(call: Call, byteCount: Long) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key] ?: return
        builder.requestBodySize(byteCount)
        builder.requestBodyEndCalled = true
        builder.requestStartTime?.let { startTime ->
            builder.requestDurationMs(timeProvider.elapsedRealtime - startTime)
        }
    }

    override fun requestFailed(call: Call, ioe: IOException) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.elapsedRealtime)
        if (isTimeout(ioe)) {
            builder?.isTimeout(true)
        }
    }

    override fun responseHeadersStart(call: Call) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.responseStartTime = timeProvider.elapsedRealtime
    }

    override fun responseHeadersEnd(call: Call, response: Response) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.responseHeadersEndTime = timeProvider.elapsedRealtime
        if (configProvider.shouldTrackHttpResponseBody(call.request().url.toString())) {
            val filteredHeaders = response.headers.names()
                .filter { headerName ->
                    configProvider.shouldTrackHttpHeader(headerName)
                }
                .associateWith { headerName ->
                    response.headers.values(headerName).joinToString()
                }

            httpDataBuilders[key]?.responseHeaders(filteredHeaders)
        }

        httpDataBuilders[key]?.statusCode(response.code)
    }

    override fun responseBodyEnd(call: Call, byteCount: Long) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key] ?: return
        builder.responseBodySize(byteCount)
        builder.responseBodyEndCalled = true
        builder.responseStartTime?.let { startTime ->
            builder.responseDurationMs(timeProvider.elapsedRealtime - startTime)
        }
    }

    override fun responseFailed(call: Call, ioe: IOException) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.elapsedRealtime)
        if (isTimeout(ioe)) {
            builder?.isTimeout(true)
        }
        trackEvent(call, builder)
    }

    override fun cacheHit(call: Call, response: Response) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.cacheStatus("hit")
    }

    override fun cacheMiss(call: Call) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.cacheStatus("miss")
    }

    override fun cacheConditionalHit(call: Call, cachedResponse: Response) {
        val key = getIdentityHash(call)
        httpDataBuilders[key]?.cacheStatus("conditional_hit")
    }

    override fun callEnd(call: Call) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.endTime(timeProvider.elapsedRealtime)
        computeFallbackDurations(builder)
        trackEvent(call, builder)
    }

    override fun callFailed(call: Call, ioe: IOException) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.elapsedRealtime)
        if (isTimeout(ioe)) {
            builder?.isTimeout(true)
        }
        computeFallbackDurations(builder)
        trackEvent(call, builder)
    }

    override fun request(call: Call, request: Request) {
        if (configProvider.shouldTrackHttpRequestBody(request.url.toString())) {
            val key = getIdentityHash(call)
            val builder = httpDataBuilders[key]
            val requestBody = getRequestBodyByteArray(request)
            val decodedBody = requestBody?.decodeToString(0, requestBody.size, false)
            builder?.requestBody(decodedBody)
        }
    }

    override fun response(call: Call, request: Request, response: Response) {
        if (configProvider.shouldTrackHttpResponseBody(request.url.toString())) {
            val key = getIdentityHash(call)
            val builder = httpDataBuilders[key]
            val responseBody = getResponseBodyByteString(response)
            builder?.responseBody(responseBody?.utf8())
        }
    }

    private fun trackEvent(call: Call, builder: HttpData.Builder?) {
        val key = getIdentityHash(call)
        if (!httpDataBuilders.containsKey(key)) {
            return
        }
        builder?.let {
            val httpEvent = it.build()
            signalProcessor.track(
                type = EventType.HTTP,
                timestamp = timeProvider.now(),
                data = httpEvent,
            )
        }
        httpDataBuilders.remove(key)
    }

    private fun getResponseBodyByteString(response: Response): ByteString? {
        response.body?.let { responseBody ->
            try {
                val source = responseBody.source()
                val contentLength = responseBody.contentLength()
                val requestSize = if (contentLength < 0) {
                    MAX_BODY_SIZE_BYTES
                } else {
                    minOf(MAX_BODY_SIZE_BYTES, contentLength)
                }
                source.request(requestSize)

                return source.buffer.use { buffer ->
                    val actualSize = buffer.size

                    if (actualSize <= MAX_BODY_SIZE_BYTES) {
                        buffer.snapshot()
                    } else {
                        val truncatedBytes = buffer.readByteString(MAX_BODY_SIZE_BYTES)
                        Buffer().use { tempBuffer ->
                            tempBuffer.write(truncatedBytes)
                            tempBuffer.writeUtf8(BODY_TRUNCATED_MESSAGE)
                            tempBuffer.readByteString()
                        }
                    }
                }
            } catch (e: IOException) {
                logger.log(LogLevel.Debug, "Failed to read response body", e)
            }
        }
        return null
    }

    private fun getRequestBodyByteArray(request: Request): ByteArray? {
        try {
            val requestCopy = request.newBuilder().build()
            val requestBody = requestCopy.body
            if (requestBody != null) {
                val contentLength = requestBody.contentLength()
                if (contentLength > MAX_BODY_SIZE_BYTES) {
                    return Buffer().use { buffer ->
                        requestBody.writeTo(buffer)
                        val truncatedBytes = buffer.readByteArray(MAX_BODY_SIZE_BYTES)
                        truncatedBytes + BODY_TRUNCATED_MESSAGE.toByteArray()
                    }
                } else {
                    return Buffer().use { buffer ->
                        requestBody.writeTo(buffer)
                        val actualSize = buffer.size

                        if (actualSize <= MAX_BODY_SIZE_BYTES) {
                            buffer.readByteArray()
                        } else {
                            val truncatedBytes = buffer.readByteArray(MAX_BODY_SIZE_BYTES)
                            truncatedBytes + BODY_TRUNCATED_MESSAGE.toByteArray()
                        }
                    }
                }
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Debug, "Failed to read request body", e)
        }
        return null
    }

    /**
     * Computes request/response durations using fallback end times when body callbacks
     * were not fired (e.g., GET requests with no body, or 204/304 responses).
     */
    private fun computeFallbackDurations(builder: HttpData.Builder?) {
        if (builder == null) return
        // If requestBodyEnd was never called, use requestHeadersEnd as fallback
        if (!builder.requestBodyEndCalled) {
            val startTime = builder.requestStartTime
            val endTime = builder.requestHeadersEndTime
            if (startTime != null && endTime != null) {
                builder.requestDurationMs(endTime - startTime)
            }
        }
        // If responseBodyEnd was never called, use responseHeadersEnd as fallback
        if (!builder.responseBodyEndCalled) {
            val startTime = builder.responseStartTime
            val endTime = builder.responseHeadersEndTime
            if (startTime != null && endTime != null) {
                builder.responseDurationMs(endTime - startTime)
            }
        }
    }

    private fun isTimeout(ioe: IOException): Boolean {
        return ioe is SocketTimeoutException ||
            (ioe is InterruptedIOException && ioe.message?.contains("timeout", ignoreCase = true) == true)
    }

    private fun getIdentityHash(call: Call): String = Integer.toHexString(System.identityHashCode(call))
}
