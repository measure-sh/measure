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
     * Size of the request body in bytes.
     */
    val request_body_size: Long?,

    /**
     * Size of the response body in bytes.
     */
    val response_body_size: Long?,

    /**
     * Timestamp when the request was sent.
     */
    val request_timestamp: String?,

    /**
     * Timestamp when the response was received.
     */
    val response_timestamp: String?,

    /**
     * The uptime at which the http call started, in milliseconds.
     */
    val start_time: Long?,

    /**
     * The uptime at which the http call ended, in milliseconds.
     */
    val end_time: Long?,

    /**
     * The uptime at which the dns lookup started, in milliseconds.
     */
    val dns_start: Long?,

    /**
     * The uptime at which the dns lookup ended, in milliseconds.
     */
    val dns_end: Long?,

    /**
     * The uptime at which the connection was acquired, in milliseconds.
     */
    val connect_start: Long?,

    /**
     * The uptime at which the connection ended, in milliseconds.
     */
    val connect_end: Long?,

    /**
     * The uptime at which request started, in milliseconds.
     */
    val request_start: Long?,

    /**
     * The uptime at which request ended, in milliseconds.
     */
    val request_end: Long?,

    /**
     * The uptime at which request headers started to be sent, in milliseconds.
     */
    val request_headers_start: Long?,

    /**
     * The uptime at which request headers were sent, in milliseconds.
     */
    val request_headers_end: Long?,

    /**
     * The uptime at which request body started to be sent, in milliseconds.
     */
    val request_body_start: Long?,

    /**
     * The uptime at which request body was sent, in milliseconds.
     */
    val request_body_end: Long?,

    /**
     * The uptime at which response started to be received, in milliseconds.
     */
    val response_start: Long?,

    /**
     * The uptime at which response ended, in milliseconds.
     */
    val response_end: Long?,

    /**
     * The uptime at which response headers started to be received, in milliseconds.
     */
    val response_headers_start: Long?,

    /**
     * The uptime at which response headers were received, in milliseconds.
     */
    val response_headers_end: Long?,

    /**
     * The uptime at which response body started to be received, in milliseconds.
     */
    val response_body_start: Long?,

    /**
     * The uptime at which response body was received, in milliseconds.
     */
    val response_body_end: Long?,

    /**
     * Request headers size in bytes.
     */
    val request_headers_size: Long?,

    /**
     * Response headers size in bytes.
     */
    val response_headers_size: Long?,

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
    val request_headers: Map<String, String>,

    /**
     * The response headers.
     */
    val response_headers: Map<String, String>,

    /**
     * The name of the client that sent the request.
     *
     * @see [HttpClientName]
     */
    val client: String,
    @Transient val timestamp: Long = -1L,
    @Transient val thread_name: String = "",
)
