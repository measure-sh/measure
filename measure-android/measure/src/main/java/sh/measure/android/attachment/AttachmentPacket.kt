package sh.measure.android.attachment

import kotlinx.serialization.Serializable

@Serializable
internal data class AttachmentPacket(
    val timestamp: String,
    val name: String,
    val type: String,
    val blob: String,
    val extension: String?,
)
