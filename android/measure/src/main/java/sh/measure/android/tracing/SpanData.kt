package sh.measure.android.tracing

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
    val attributes: Map<String, Any?> = emptyMap(),
    val userDefinedAttrs: MutableMap<String, Any?> = mutableMapOf(),
    val checkpoints: MutableList<Checkpoint> = mutableListOf(),
    val hasEnded: Boolean,
    val isSampled: Boolean,
)
