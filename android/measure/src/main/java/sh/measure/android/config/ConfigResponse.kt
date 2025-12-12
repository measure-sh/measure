package sh.measure.android.config

// First, add this data class to represent the config response
internal sealed class ConfigResponse {
    data class Success(
        val body: String,
        val eTag: String?,
        val cacheControl: Long
    ) : ConfigResponse()

    object NotModified : ConfigResponse()

    data class Error(val exception: Exception? = null) : ConfigResponse()
}
