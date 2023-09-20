package sh.measure.android.session

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import sh.measure.android.tracker.SignalType
import java.util.Locale

@Serializable
internal data class SessionReport(
    val session_id: String,
    val timestamp: String,
    val resource: JsonElement,
    val events: List<JsonElement>,
) {
    class Builder {
        private var sessionId: String? = null
        private var resource: JsonElement? = null
        private var timestamp: Long? = null
        private var signals: List<SignalReport>? = null

        fun sessionId(sessionId: String): Builder = apply { this.sessionId = sessionId }
        fun timestamp(timestamp: Long): Builder = apply { this.timestamp = timestamp }
        fun resource(resource: JsonElement): Builder = apply { this.resource = resource }
        fun signals(signals: List<SignalReport>): Builder = apply { this.signals = signals }

        fun build(): SessionReport {
            requireNotNull(sessionId) { "SessionId must be set" }
            requireNotNull(resource) { "Resource must be set" }
            requireNotNull(timestamp) { "Timestamp must be set" }
            requireNotNull(signals) { "Signals must be set" }
            return SessionReport(
                sessionId!!, timestamp!!.iso8601Timestamp(), resource!!, signals!!.events()
            )
        }
    }
}

internal fun Long.iso8601Timestamp(): String {
    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSS'Z'", Locale.US)
    return sdf.format(this)
}

@Serializable
internal data class SignalReport(
    val timestamp: String, val signalType: String, val dataType: String, val data: JsonElement
)

internal fun List<SignalReport>.events(): List<JsonElement> {
    return filter { it.signalType == SignalType.EVENT }.map {
        val event = """
            {
                "timestamp": "${it.timestamp}",
                "type": "${it.dataType}",
                "${it.dataType}": ${it.data}
            }
        """.trimIndent()
        Json.parseToJsonElement(event)
    }
}