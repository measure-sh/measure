package sh.measure.android.tracing

import android.annotation.SuppressLint

/**
 * Annotates a specific time on a span.
 */
internal data class Checkpoint(
    val name: String,
    val timestamp: Long,
)
