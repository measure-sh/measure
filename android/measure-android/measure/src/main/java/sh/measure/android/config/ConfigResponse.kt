package sh.measure.android.config

internal sealed class ConfigResponse {
    data class Success(
        val body: String,
        val eTag: String?,
        val cacheControl: Long,
    ) : ConfigResponse()

    object NotModified : ConfigResponse()

    data class Error(val exception: Exception? = null) : ConfigResponse()
}
