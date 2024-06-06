package sh.measure.android.okhttp

import okhttp3.Call
import okhttp3.EventListener
import okhttp3.Headers
import okhttp3.Request
import okhttp3.Response
import okio.Buffer
import okio.ByteString
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.containsIgnoreCase
import java.io.IOException

internal abstract class OkHttpEventCollector : EventListener() {
    open fun request(call: Call, request: Request) {}
    open fun response(call: Call, request: Request, response: Response) {}
}

internal class OkHttpEventCollectorImpl(
    private val logger: Logger,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
) : OkHttpEventCollector() {
    private val httpDataBuilders: MutableMap<String, HttpData.Builder> by lazy(
        LazyThreadSafetyMode.NONE,
    ) { mutableMapOf() }

    override fun callStart(call: Call) {
        InternalTrace.beginSection("OkHttpEventProcessor.callStart")
        val key = getIdentityHash(call)
        val request = call.request()
        httpDataBuilders[key] =
            HttpData.Builder().url(request.url.toString()).startTime(timeProvider.uptimeInMillis)
                .method(request.method.lowercase()).startTime(timeProvider.uptimeInMillis)
                .client(HttpClientName.OK_HTTP)
        InternalTrace.endSection()
    }

    override fun requestHeadersEnd(call: Call, request: Request) {
        InternalTrace.beginSection("OkHttpEventProcessor.requestHeadersEnd")
        val key = getIdentityHash(call)
        if (configProvider.enableHttpHeaders) {
            httpDataBuilders[key]?.requestHeaders(
                parseAllowedHeaders(request.headers),
            )
        }
        InternalTrace.endSection()
    }

    override fun requestFailed(call: Call, ioe: IOException) {
        InternalTrace.beginSection("OkHttpEventProcessor.requestFailed")
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.uptimeInMillis)
        InternalTrace.endSection()
    }

    override fun responseHeadersEnd(call: Call, response: Response) {
        InternalTrace.beginSection("OkHttpEventProcessor.responseHeadersEnd")
        val key = getIdentityHash(call)
        if (configProvider.enableHttpHeaders) {
            httpDataBuilders[key]?.responseHeaders(
                parseAllowedHeaders(response.headers),
            )
        }
        httpDataBuilders[key]?.statusCode(response.code)
        InternalTrace.endSection()
    }

    override fun responseFailed(call: Call, ioe: IOException) {
        InternalTrace.beginSection("OkHttpEventProcessor.responseFailed")
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.uptimeInMillis)
        trackEvent(call, builder)
        InternalTrace.endSection()
    }

    override fun callEnd(call: Call) {
        InternalTrace.beginSection("OkHttpEventProcessor.callEnd")
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.endTime(timeProvider.uptimeInMillis)
        trackEvent(call, builder)
        InternalTrace.endSection()
    }

    override fun callFailed(call: Call, ioe: IOException) {
        InternalTrace.beginSection("OkHttpEventProcessor.callFailed")
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.uptimeInMillis)
        trackEvent(call, builder)
        InternalTrace.endSection()
    }

    override fun request(call: Call, request: Request) {
        InternalTrace.beginSection("OkHttpEventProcessor.request")
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        if (configProvider.shouldTrackHttpBody(
                request.url.toString(), getContentTypeHeader(request)
            )
        ) {
            val requestBody = getRequestBodyByteArray(request)
            val decodedBody = requestBody?.decodeToString(0, requestBody.size, false)
            builder?.requestBody(decodedBody)
        }
        InternalTrace.endSection()
    }

    override fun response(call: Call, request: Request, response: Response) {
        InternalTrace.beginSection("OkHttpEventProcessor.response")
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        if (configProvider.shouldTrackHttpBody(
                request.url.toString(), getContentTypeHeader(response)
            )
        ) {
            val responseBody = getResponseBodyByteString(response)
            builder?.responseBody(responseBody?.utf8())
        }
        InternalTrace.endSection()
    }

    private fun trackEvent(call: Call, builder: HttpData.Builder?) {
        val key = getIdentityHash(call)
        if (!httpDataBuilders.containsKey(key)) {
            return
        }
        InternalTrace.beginSection("OkHttpEventProcessor.trackEvent")
        builder?.let {
            val httpEvent = it.build()
            eventProcessor.track(
                type = EventType.HTTP,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                data = httpEvent,
            )
        }
        httpDataBuilders.remove(key)
        InternalTrace.endSection()
    }

    /**
     * Takes a snapshot of the response body and returns it as a [ByteString]. Reading the response
     * body directly from the [Response] object clears the buffer, so we need to take a snapshot
     * instead of reading it directly.
     */
    private fun getResponseBodyByteString(response: Response): ByteString? {
        response.body?.let { responseBody ->
            val source = responseBody.source()
            source.request(Int.MAX_VALUE.toLong())
            return source.buffer.use {
                it.snapshot()
            }
        }
        return null
    }

    private fun getRequestBodyByteArray(request: Request): ByteArray? {
        try {
            val requestCopy = request.newBuilder().build()
            val requestBody = requestCopy.body
            if (requestBody != null) {
                val readByteArray = Buffer().use {
                    requestBody.writeTo(it)
                    it.readByteArray()
                }
                return readByteArray
            }
        } catch (e: IOException) {
            logger.log(LogLevel.Error, "Error reading request body", e)
        }
        return null
    }

    private fun parseAllowedHeaders(headers: Headers) = headers.toMultimap()
        .filter { (key, _) -> !configProvider.httpHeadersBlocklist.containsIgnoreCase(key) }
        .mapValues { it.value.joinToString() }

    private fun getContentTypeHeader(request: Request): String? {
        return request.header("Content-Type")
    }

    private fun getContentTypeHeader(response: Response): String? {
        return response.header("Content-Type")
    }

    private fun getIdentityHash(call: Call): String {
        return Integer.toHexString(System.identityHashCode(call))
    }
}
