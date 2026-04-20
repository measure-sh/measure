package sh.measure.kmp.tracing

import sh.measure.kmp.attributes.AttributeValue

/**
 * Represents a unit of work or operation within a trace.
 *
 * A span represents a single operation within a trace. Spans can be nested to form
 * a trace tree that represents the end-to-end execution path of an operation.
 * Each span captures timing data, status, parent-child relationships to provide context
 * about the operation.
 */
interface Span {
    /**
     * Gets the unique identifier for the trace this span belongs to.
     */
    val traceId: String

    /**
     * Gets the unique identifier for this span.
     */
    val spanId: String

    /**
     * Gets the span ID of this span's parent, if one exists.
     */
    val parentId: String?

    /**
     * Indicates whether this span has been selected for collection and export.
     */
    val isSampled: Boolean

    /**
     * Updates the status of this span.
     */
    fun setStatus(status: SpanStatus): Span

    /**
     * Sets the parent span for this span, establishing a hierarchical relationship.
     */
    fun setParent(parentSpan: Span): Span

    /**
     * Adds a checkpoint marking a significant moment during the span's lifetime.
     */
    fun setCheckpoint(name: String): Span

    /**
     * Updates the name of the span.
     */
    fun setName(name: String): Span

    fun setAttribute(key: String, value: String): Span
    fun setAttribute(key: String, value: Long): Span
    fun setAttribute(key: String, value: Int): Span
    fun setAttribute(key: String, value: Double): Span
    fun setAttribute(key: String, value: Boolean): Span

    /**
     * Adds multiple attributes to this span.
     */
    fun setAttributes(attributes: Map<String, AttributeValue>): Span

    /**
     * Removes an attribute from this span. No-op if the attribute does not exist.
     */
    fun removeAttribute(key: String): Span

    /**
     * Marks this span as completed, recording its end time.
     */
    fun end(): Span

    /**
     * Marks this span as completed using the specified end time.
     */
    fun end(timestamp: Long): Span

    /**
     * Checks if this span has been completed.
     */
    fun hasEnded(): Boolean

    /**
     * Gets the total duration of this span in milliseconds.
     */
    fun getDuration(): Long
}
