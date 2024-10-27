package sh.measure.android.tracing

/**
 * Represents a span in a trace.
 */
internal interface Span {
    /**
     * Unique identifier for the trace this span is part of. Created when a root span
     * is created.
     */
    val traceId: String

    /**
     * Unique identifier for a span in the trace. Created when a new span is started.
     */
    val spanId: String

    /**
     * The name of the span.
     */
    val name: String

    /**
     * The span id of the parent.
     */
    val parentId: String?

    /**
     * The time since epoch when the span started.
     */
    val startTime: Long

    /**
     * Returns the status of the span.
     */
    fun getStatus(): SpanStatus

    /**
     * Updates the status of the span. Behaviour is undefined if the span has ended.
     */
    fun setStatus(status: SpanStatus): Span

    /**
     * Ends the span.
     *
     * A span can only be ended once. Attempt to end an already ended span is no-op.
     */
    fun end(): Span

    /**
     * Ends the span and sets the [timestamp] as it's end time. Useful if a span is being collected
     * for an operation that already ended.
     *
     * A span can only be ended once. Attempt to end an already ended span is a no-op.
     *
     * @param timestamp The milliseconds since epoch when the span ended.
     */
    fun end(timestamp: Long): Span

    /**
     * Returns whether the span has ended or not.
     */
    fun hasEnded(): Boolean

    /**
     * Puts this span in scope. Putting in scope means putting the span in thread local. Any spans
     * created on this thread will now have this span set as it's parent automatically.
     */
    fun makeCurrent(): Scope

    /**
     * Runs the [block] of code in this span's scope. Any spans
     * created within this block on the same thread will have this span set as it's parent
     * automatically.
     */
    fun <T> withScope(block: () -> T): T

    /**
     * The duration of the span once it ends. If the span has not ended, returns 0.
     */
    fun getDuration(): Long

    companion object {

        /**
         * Returns the current span from thread local if any.
         */
        internal fun current(): Span? {
            return SpanStorage.instance.current()
        }

        internal fun invalid(): Span {
            return InvalidSpan()
        }
    }
}
