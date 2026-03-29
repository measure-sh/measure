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
     * Number of bytes sent in the request body.
     */
    val bytes_sent: Long? = null,

    /**
     * Number of bytes received in the response body.
     */
    val bytes_received: Long? = null,

    /**
     * Duration of DNS resolution in milliseconds.
     */
    val dns_duration: Long? = null,

    /**
     * Duration of TLS handshake in milliseconds.
     */
    val tls_duration: Long? = null,

    /**
     * Duration to send the request in milliseconds.
     */
    val request_send_duration: Long? = null,

    /**
     * Duration to read the response in milliseconds.
     */
    val response_read_duration: Long? = null,

    /**
     * Whether the request failed without receiving a server response.
     */
    val is_client_error: Boolean? = null,

    /**
     * Whether the request failed due to a timeout.
     */
    val is_timeout: Boolean? = null,
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
        private var bytesSent: Long? = null
        private var bytesReceived: Long? = null
        private var dnsDuration: Long? = null
        private var tlsDuration: Long? = null
        private var requestSendDuration: Long? = null
        private var responseReadDuration: Long? = null
        private var isClientError: Boolean? = null
        private var isTimeout: Boolean? = null

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

        fun bytesSent(bytesSent: Long?) = apply { this.bytesSent = bytesSent }

        fun bytesReceived(bytesReceived: Long?) = apply { this.bytesReceived = bytesReceived }

        fun dnsDuration(dnsDuration: Long?) = apply { this.dnsDuration = dnsDuration }

        fun tlsDuration(tlsDuration: Long?) = apply { this.tlsDuration = tlsDuration }

        fun requestSendDuration(requestSendDuration: Long?) = apply { this.requestSendDuration = requestSendDuration }

        fun responseReadDuration(responseReadDuration: Long?) = apply { this.responseReadDuration = responseReadDuration }

        fun isClientError(isClientError: Boolean?) = apply { this.isClientError = isClientError }

        fun isTimeout(isTimeout: Boolean?) = apply { this.isTimeout = isTimeout }

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
            bytes_sent = bytesSent,
            bytes_received = bytesReceived,
            dns_duration = dnsDuration,
            tls_duration = tlsDuration,
            request_send_duration = requestSendDuration,
            response_read_duration = responseReadDuration,
            is_client_error = isClientError,
            is_timeout = isTimeout,
        )
    }
}
