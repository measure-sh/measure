package sh.measure.android.okhttp

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
internal data class HttpEvent(
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
    val request_headers: Map<String, String>?,

    /**
     * The response headers.
     */
    val response_headers: Map<String, String>?,

    /**
     * The request body.
     */
    val request_body: String?,

    /**
     * The response body.
     */
    val response_body: String?,

    /**
     * The name of the client that sent the request.
     *
     * @see [HttpClientName]
     */
    val client: String,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient val timestamp: Long = -1L,
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
        private var timestamp: Long = -1L

        fun url(url: String) = apply { this.url = url }

        fun method(method: String) = apply { this.method = method }

        fun statusCode(statusCode: Int?) = apply { this.statusCode = statusCode }

        fun startTime(startTime: Long?) = apply { this.startTime = startTime }

        fun endTime(endTime: Long?) = apply { this.endTime = endTime }

        fun failureReason(failureReason: String?) = apply { this.failureReason = failureReason }

        fun failureDescription(failureDescription: String?) =
            apply { this.failureDescription = failureDescription }

        fun requestHeaders(requestHeaders: Map<String, String>) =
            apply { this.requestHeaders = requestHeaders }

        fun responseHeaders(responseHeaders: Map<String, String>) =
            apply { this.responseHeaders = responseHeaders }

        fun requestBody(requestBody: String?) = apply { this.requestBody = requestBody }

        fun responseBody(responseBody: String?) = apply { this.responseBody = responseBody }

        fun client(client: String) = apply { this.client = client }

        fun timestamp(timestamp: Long) = apply { this.timestamp = timestamp }

        fun build(): HttpEvent {
            return HttpEvent(
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
                timestamp = timestamp,
            )
        }
    }
}
