package sh.measure.android.okhttp

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class HttpData(
    /**
     * The complete URL of the request.
     */
    val url: String,

    /**
     * HTTP method, like get, post, put, etc. In lowercase.
     */
    val method: String,

    /**
     * HTTP response code. Example: 200, 401, 500, etc.
     */
    val status_code: Int?,

    /**
     * The uptime at which the http call started, in milliseconds.
     */
    val start_time: Long?,

    /**
     * The uptime at which the http call ended, in milliseconds.
     */
    val end_time: Long?,

    /**
     * The reason for the failure. Typically the IOException class name.
     */
    val failure_reason: String?,

    /**
     * The description of the failure. Typically the IOException message.
     */
    val failure_description: String?,

    /**
     * The request headers.
     */
    var request_headers: Map<String, String>?,

    /**
     * The response headers.
     */
    var response_headers: Map<String, String>?,

    /**
     * The request body.
     */
    var request_body: String?,

    /**
     * The response body.
     */
    var response_body: String?,

    /**
     * The name of the client that sent the request.
     *
     * @see [HttpClientName]
     */
    val client: String,

    /**
     * The number of bytes sent in the request body.
     */
    val request_body_size: Long? = null,

    /**
     * The number of bytes received in the response body.
     */
    val response_body_size: Long? = null,

    /**
     * The time taken for DNS resolution, in milliseconds.
     */
    val dns_duration_ms: Long? = null,

    /**
     * The time taken to establish a TCP connection, in milliseconds.
     */
    val connect_time_ms: Long? = null,

    /**
     * The time taken for the TLS handshake, in milliseconds.
     */
    val tls_time_ms: Long? = null,

    /**
     * The cache status: "hit", "miss", or "conditional_hit".
     */
    val cache_status: String? = null,

    /**
     * Whether the failure was caused by a timeout.
     */
    val is_timeout: Boolean? = null,

    /**
     * The time taken to send the request (headers + body), in milliseconds.
     */
    val request_duration_ms: Long? = null,

    /**
     * The time taken to read the response (headers + body), in milliseconds.
     */
    val response_duration_ms: Long? = null,
) {

    // Builder
    class Builder {
        private var url: String = ""
        private var method: String = ""
        private var statusCode: Int? = null
        private var startTime: Long? = null
        private var endTime: Long? = null
        private var failureReason: String? = null
        private var failureDescription: String? = null
        private var requestHeaders: Map<String, String> = emptyMap()
        private var responseHeaders: Map<String, String> = emptyMap()
        private var requestBody: String? = null
        private var responseBody: String? = null
        private var client: String = ""
        private var requestBodySize: Long? = null
        private var responseBodySize: Long? = null
        private var dnsDurationMs: Long? = null
        private var connectTimeMs: Long? = null
        private var tlsTimeMs: Long? = null
        private var cacheStatus: String? = null
        private var isTimeout: Boolean? = null
        private var requestDurationMs: Long? = null
        private var responseDurationMs: Long? = null

        // Intermediate timestamps for computing durations (not serialized)
        internal var dnsStartTime: Long? = null
        internal var connectStartTime: Long? = null
        internal var secureConnectStartTime: Long? = null
        internal var requestStartTime: Long? = null
        internal var requestHeadersEndTime: Long? = null
        internal var responseStartTime: Long? = null
        internal var responseHeadersEndTime: Long? = null
        internal var requestBodyEndCalled: Boolean = false
        internal var responseBodyEndCalled: Boolean = false

        fun url(url: String) = apply { this.url = url }

        fun method(method: String) = apply { this.method = method }

        fun statusCode(statusCode: Int?) = apply { this.statusCode = statusCode }

        fun startTime(startTime: Long?) = apply { this.startTime = startTime }

        fun endTime(endTime: Long?) = apply { this.endTime = endTime }

        fun failureReason(failureReason: String?) = apply { this.failureReason = failureReason }

        fun failureDescription(failureDescription: String?) = apply { this.failureDescription = failureDescription }

        fun requestHeaders(requestHeaders: Map<String, String>) = apply { this.requestHeaders = requestHeaders }

        fun responseHeaders(responseHeaders: Map<String, String>) = apply { this.responseHeaders = responseHeaders }

        fun requestBody(requestBody: String?) = apply { this.requestBody = requestBody }

        fun responseBody(responseBody: String?) = apply { this.responseBody = responseBody }

        fun client(client: String) = apply { this.client = client }

        fun requestBodySize(size: Long?) = apply { this.requestBodySize = size }

        fun responseBodySize(size: Long?) = apply { this.responseBodySize = size }

        fun dnsDurationMs(duration: Long?) = apply { this.dnsDurationMs = duration }

        fun connectTimeMs(time: Long?) = apply { this.connectTimeMs = time }

        fun tlsTimeMs(time: Long?) = apply { this.tlsTimeMs = time }

        fun cacheStatus(status: String?) = apply { this.cacheStatus = status }

        fun isTimeout(timeout: Boolean?) = apply { this.isTimeout = timeout }

        fun requestDurationMs(duration: Long?) = apply { this.requestDurationMs = duration }

        fun responseDurationMs(duration: Long?) = apply { this.responseDurationMs = duration }

        fun build(): HttpData = HttpData(
            url = url,
            method = method,
            status_code = statusCode,
            start_time = startTime,
            end_time = endTime,
            failure_reason = failureReason,
            failure_description = failureDescription,
            request_headers = requestHeaders,
            response_headers = responseHeaders,
            request_body = requestBody,
            response_body = responseBody,
            client = client,
            request_body_size = requestBodySize,
            response_body_size = responseBodySize,
            dns_duration_ms = dnsDurationMs,
            connect_time_ms = connectTimeMs,
            tls_time_ms = tlsTimeMs,
            cache_status = cacheStatus,
            is_timeout = isTimeout,
            request_duration_ms = requestDurationMs,
            response_duration_ms = responseDurationMs,
        )
    }
}
