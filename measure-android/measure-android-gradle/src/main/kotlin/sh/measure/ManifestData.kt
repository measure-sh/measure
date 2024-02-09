package sh.measure

import kotlinx.serialization.Serializable

@Serializable
data class ManifestData(
    val apiKey: String,
    val versionCode: String,
    val appUniqueId: String,
    val versionName: String
)

