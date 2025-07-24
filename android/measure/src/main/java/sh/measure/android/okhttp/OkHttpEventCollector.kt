package sh.measure.android.okhttp

import okhttp3.Call
import okhttp3.EventListener
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
        if (configProvider.shouldTrackHttpUrl(url)) {
            httpDataBuilders[key] =
                HttpData.Builder().url(url).startTime(timeProvider.elapsedRealtime)
                    .method(request.method.lowercase()).startTime(timeProvider.elapsedRealtime)
                    .client(HttpClientName.OK_HTTP)
        }
    }

    override fun requestHeadersEnd(call: Call, request: Request) {
        val key = getIdentityHash(call)
        if (configProvider.trackHttpHeaders) {
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

    override fun requestFailed(call: Call, ioe: IOException) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.elapsedRealtime)
    }

    override fun responseHeadersEnd(call: Call, response: Response) {
        val key = getIdentityHash(call)
        if (configProvider.trackHttpHeaders) {
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

    override fun responseFailed(call: Call, ioe: IOException) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.elapsedRealtime)
        trackEvent(call, builder)
    }

    override fun callEnd(call: Call) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.endTime(timeProvider.elapsedRealtime)
        trackEvent(call, builder)
    }

    override fun callFailed(call: Call, ioe: IOException) {
        val key = getIdentityHash(call)
        val builder = httpDataBuilders[key]
        builder?.failureReason(ioe.javaClass.name)?.failureDescription(ioe.message)
            ?.endTime(timeProvider.elapsedRealtime)
        trackEvent(call, builder)
    }

    override fun request(call: Call, request: Request) {
        if (configProvider.trackHttpBody) {
            val key = getIdentityHash(call)
            val builder = httpDataBuilders[key]
            val requestBody = getRequestBodyByteArray(request)
            val decodedBody = requestBody?.decodeToString(0, requestBody.size, false)
            builder?.requestBody(decodedBody)
        }
    }

    override fun response(call: Call, request: Request, response: Response) {
        if (configProvider.trackHttpBody) {
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
            logger.log(LogLevel.Debug, "Failed to read request body", e)
        }
        return null
    }

    private fun getIdentityHash(call: Call): String = Integer.toHexString(System.identityHashCode(call))
}
