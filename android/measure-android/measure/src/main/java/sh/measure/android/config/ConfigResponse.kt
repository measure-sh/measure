package sh.measure.android.config

internal sealed class ConfigResponse {
    data class Success(
        val body: String,
        val eTag: String?,
        val cacheControlMs: Long,
    ) : ConfigResponse()

    data class NotModified(val cacheControlMs: Long) : ConfigResponse()

    data class Error(val exception: Exception? = null) : ConfigResponse()
}
