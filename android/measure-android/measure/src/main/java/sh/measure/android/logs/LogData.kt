package sh.measure.android.logs

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
internal data class LogData(
    @SerialName("severity_text")
    val severityText: String,
    @SerialName("severity_number")
    val severityNumber: Int,
    @SerialName("body")
    val body: String,
)
