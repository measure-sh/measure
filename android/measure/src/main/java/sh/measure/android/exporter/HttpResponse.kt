package sh.measure.android.exporter

import android.annotation.SuppressLint
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class EventsResponse(
    @SerialName("attachments")
    val attachments: List<SignedAttachment>? = null,
)

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class SignedAttachment(
    @SerialName("id")
    val id: String,
    @SerialName("type")
    val type: String,
    @SerialName("filename")
    val filename: String,
    @SerialName("upload_url")
    val uploadUrl: String,
    @SerialName("expires_at")
    val expiresAt: String,
    @SerialName("headers")
    val headers: Map<String, String>,
)
