package sh.measure.android.exporter

/**
 * Represents the response of an HTTP request. It can be either a success or an error.
 */
internal sealed class HttpResponse<out T> {
    data class Success<out T>(val data: T? = null) : HttpResponse<T?>()
    sealed class Error(val e: Exception?) : HttpResponse<Nothing>() {
        data class RateLimitError(val exception: Exception? = null) : Error(exception)
        data class ServerError(val exception: Exception? = null) : Error(exception)
        data class ClientError(val exception: Exception? = null) : Error(exception)
        data class UnknownError(val exception: Exception? = null) : Error(exception)
    }
}
