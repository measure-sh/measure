package sh.measure.android.tracing

internal data class SpanData(
    val name: String,
    val spanId: String,
    val parentId: String?,
    val startTime: Long,
    val endTime: Long,
    val duration: Long,
    val status: SpanStatus,
    val hasEnded: Boolean,
)
