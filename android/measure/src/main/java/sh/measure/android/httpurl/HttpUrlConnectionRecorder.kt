package sh.measure.android.httpurl

import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.okhttp.HttpClientName
import sh.measure.android.okhttp.HttpData
import sh.measure.android.utils.TimeProvider
import java.net.HttpURLConnection
import java.util.concurrent.atomic.AtomicBoolean

internal const val MAX_BODY_SIZE_BYTES: Long = 256 * 1024L
internal const val BODY_TRUNCATED_MESSAGE: String = "\n... [Body truncated - exceeded 256KB limit]"

/**
 * Per-connection state machine. Owned by a single [MsrHttpURLConnection] /
 * [MsrHttpsURLConnection] wrapper. The wrapper invokes the on* hooks at the
 * appropriate JDK lifecycle points; the recorder builds an [HttpData] and tracks
 * it through the [HttpUrlConnectionEventCollector] exactly once.
 */
internal class HttpUrlConnectionRecorder(
    private val collector: HttpUrlConnectionEventCollector,
    private val configProvider: ConfigProvider,
    private val timeProvider: TimeProvider,
    private val logger: Logger,
    private val url: String,
) {
    private val builder = HttpData.Builder()
        .url(url)
        .client(HttpClientName.HTTP_URL_CONNECTION)

    private val tracked: Boolean = configProvider.shouldTrackHttpEvent(url)
    private val started = AtomicBoolean(false)
    private val responseHeadersCaptured = AtomicBoolean(false)
    private val shipped = AtomicBoolean(false)

    fun isTracked(): Boolean = tracked && collector.isEnabled()

    fun shouldCaptureRequestBody(): Boolean = isTracked() && configProvider.shouldTrackHttpRequestBody(url)

    fun shouldCaptureResponseBody(): Boolean = isTracked() && configProvider.shouldTrackHttpResponseBody(url)

    fun onRequestStart(method: String) {
        if (!isTracked()) return
        if (started.compareAndSet(false, true)) {
            builder
                .method(method.lowercase())
                .startTime(timeProvider.elapsedRealtime)
        }
    }

    fun onResponseHeadersReceived(connection: HttpURLConnection) {
        if (!isTracked()) return
        if (!responseHeadersCaptured.compareAndSet(false, true)) return

        val statusCode = readResponseCodeQuietly(connection)
        if (statusCode != null) {
            builder.statusCode(statusCode)
        }

        if (configProvider.shouldTrackHttpRequestBody(url)) {
            builder.requestHeaders(captureRequestHeaders(connection))
        }
        if (configProvider.shouldTrackHttpResponseBody(url)) {
            builder.responseHeaders(captureResponseHeaders(connection))
        }
    }

    fun onRequestBodyComplete(body: ByteArray, truncated: Boolean) {
        if (!shouldCaptureRequestBody()) return
        builder.requestBody(decode(body, truncated))
    }

    fun onResponseBodyComplete(body: ByteArray, truncated: Boolean) {
        if (!shouldCaptureResponseBody()) return
        builder.responseBody(decode(body, truncated))
    }

    fun onFailure(throwable: Throwable) {
        if (!isTracked()) return
        builder
            .failureReason(throwable.javaClass.name)
            .failureDescription(throwable.message)
    }

    /**
     * Track the event. Idempotent — only the first call wins. Triggered when:
     * the response body stream is closed/EOF, [HttpURLConnection.disconnect] is
     * called, or a fatal IOException is thrown.
     */
    fun finalizeAndTrack() {
        if (!isTracked()) return
        if (!shipped.compareAndSet(false, true)) return
        builder.endTime(timeProvider.elapsedRealtime)
        try {
            collector.track(builder.build())
        } catch (e: Throwable) {
            logger.log(LogLevel.Debug, "Failed to track HttpURLConnection event", e)
        }
    }

    private fun decode(body: ByteArray, truncated: Boolean): String {
        val text = body.toString(Charsets.UTF_8)
        return if (truncated) text + BODY_TRUNCATED_MESSAGE else text
    }

    private fun captureRequestHeaders(connection: HttpURLConnection): Map<String, String> = try {
        connection.requestProperties
            .filterKeys { it != null && configProvider.shouldTrackHttpHeader(it) }
            .mapValues { (_, values) -> values.joinToString() }
    } catch (e: IllegalStateException) {
        // Already connected and the impl forbids requestProperties access in this state.
        emptyMap()
    } catch (e: Throwable) {
        logger.log(LogLevel.Debug, "Failed to capture request headers", e)
        emptyMap()
    }

    private fun captureResponseHeaders(connection: HttpURLConnection): Map<String, String> = try {
        val out = mutableMapOf<String, String>()
        var i = 0
        while (true) {
            val name = connection.getHeaderFieldKey(i)
            val value = connection.getHeaderField(i) ?: break
            if (name != null && configProvider.shouldTrackHttpHeader(name)) {
                out[name] = value
            }
            i++
        }
        out
    } catch (e: Throwable) {
        logger.log(LogLevel.Debug, "Failed to capture response headers", e)
        emptyMap()
    }

    private fun readResponseCodeQuietly(connection: HttpURLConnection): Int? = try {
        val code = connection.responseCode
        if (code <= 0) null else code
    } catch (e: Throwable) {
        null
    }
}
