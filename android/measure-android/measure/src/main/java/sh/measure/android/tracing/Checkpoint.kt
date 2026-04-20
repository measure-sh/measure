package sh.measure.android.tracing

/**
 * Annotates a specific time on a span.
 */
internal data class Checkpoint(
    val name: String,
    val timestamp: Long,
)
