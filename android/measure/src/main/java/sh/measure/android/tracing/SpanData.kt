package sh.measure.android.tracing

data class SpanData(
    val name: String,
    val spanId: String,
    val startTime: Long,
    val endTime: Long,
    val status: SpanStatus,
    val hasEnded: Boolean,
)
