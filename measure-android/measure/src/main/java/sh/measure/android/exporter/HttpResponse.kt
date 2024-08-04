package sh.measure.android.exporter

/**
 * Represents the response of an HTTP request. It can be either a success or an error.
 */
internal sealed class HttpResponse {
    data object Success : HttpResponse()
    sealed class Error : HttpResponse() {
        data class ClientError(val code: Int) : Error()
        data class ServerError(val code: Int) : Error()
        data object RateLimitError : Error()
        data class UnknownError(val exception: Exception? = null) : Error()
    }
}
