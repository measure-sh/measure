package sh.measure.android.tracing

import sh.measure.android.Measure

/**
 * Implements a [Span] and adds some internal functions to it.
 */
internal interface InternalSpan : Span {
    /**
     * Gets the name identifying this span.
     *
     * @return The name assigned to this span when it was created.
     */
    val name: String

    /**
     * Gets the session identifier associated with this span. A v4-UUID string.
     *
     * @return The unique identifier for the session this span belongs to
     */
    val sessionId: String

    /**
     * Gets the timestamp when this span was started.
     *
     * @return The start time in milliseconds since epoch, obtained via [Measure.getCurrentTime].
     */
    val startTime: Long

    /**
     * Gets the list of time-based checkpoints added to this span.
     *
     * @return A mutable list of [Checkpoint] objects, each representing a significant
     * point in time during the span's lifecycle
     *
     * Note: Checkpoints can be added during the span's lifetime using [setCheckpoint] to mark
     * important events or transitions within the traced operation.
     */
    val checkpoints: MutableList<Checkpoint>

    /**
     * Gets the map of attributes attached to this span.
     *
     * @return The attributes added to the span.
     */
    val attributes: Map<String, Any?>

    /**
     * Gets the current status of this span, indicating its outcome or error state.
     *
     * @return [SpanStatus] The status of the span.
     */
    fun getStatus(): SpanStatus

    /**
     * Returns a modifiable map of attributes.
     */
    fun getAttributesMap(): MutableMap<String, Any?>

    /**
     * Adds an attribute.
     */
    fun setAttribute(attribute: Pair<String, Any?>)

    /**
     * Converts the span to a data class for further processing and export.
     */
    fun toSpanData(): SpanData
}
