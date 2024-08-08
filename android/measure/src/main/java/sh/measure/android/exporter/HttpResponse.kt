package sh.measure.android.exporter

/**
 * Represents the response of an HTTP request. It can be either a success or an error.
 */
internal sealed class HttpResponse {
    data class Success(val body: String? = null) : HttpResponse()
    sealed class Error : HttpResponse() {
        data class ClientError(val code: Int, val body: String? = null) : Error()
        data class ServerError(val code: Int, val body: String? = null) : Error()
        data class RateLimitError(val body: String? = null) : Error()
        data class UnknownError(val exception: Exception? = null) : Error()
    }
}
