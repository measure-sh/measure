package sh.measure.android.tracing

import androidx.annotation.Keep

internal data class SpanData(
    val name: String,
    val traceId: String,
    val spanId: String,
    val parentId: String?,
    val sessionId: String,
    val startTime: Long,
    val endTime: Long,
    val duration: Long,
    val status: SpanStatus,
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    val userDefinedAttrs: Map<String, Any?> = emptyMap(),
    val checkpoints: MutableList<Checkpoint> = mutableListOf(),
    val hasEnded: Boolean,
    val isSampled: Boolean,
) {
    companion object {
        @Suppress("UNCHECKED_CAST")
        @Keep
        fun fromJson(json: Map<String, Any?>): SpanData {
            return SpanData(
                name = json["name"] as String,
                traceId = json["traceId"] as String,
                spanId = json["spanId"] as String,
                parentId = json["parentId"] as? String,
                sessionId = json["sessionId"] as String,
                startTime = json["startTime"] as Long,
                endTime = json["endTime"] as Long,
                duration = json["duration"] as Long,
                status = parseSpanStatus(json["status"]),
                attributes = (json["attributes"] as? MutableMap<String, Any?>) ?: mutableMapOf(),
                userDefinedAttrs = (json["userDefinedAttrs"] as? Map<String, Any?>) ?: emptyMap(),
                checkpoints = parseCheckpoints(json["checkpoints"]),
                hasEnded = json["hasEnded"] as Boolean,
                isSampled = json["isSampled"] as Boolean,
            )
        }

        private fun parseSpanStatus(statusValue: Any?): SpanStatus {
            return when (statusValue) {
                is String -> when (statusValue.lowercase()) {
                    "unset" -> SpanStatus.Unset
                    "ok" -> SpanStatus.Ok
                    "error" -> SpanStatus.Error
                    else -> SpanStatus.Unset
                }
                is Int -> when (statusValue) {
                    0 -> SpanStatus.Unset
                    1 -> SpanStatus.Ok
                    2 -> SpanStatus.Error
                    else -> SpanStatus.Unset
                }
                else -> SpanStatus.Unset
            }
        }

        private fun parseCheckpoints(checkpointsValue: Any?): MutableList<Checkpoint> {
            val result = mutableListOf<Checkpoint>()
            if (checkpointsValue is List<*>) {
                for (item in checkpointsValue) {
                    if (item is Map<*, *>) {
                        val name = item["name"] as? String ?: continue
                        val timestamp = item["timestamp"] as? Long ?: continue
                        result.add(Checkpoint(name, timestamp))
                    }
                }
            }
            return result
        }
    }
}
