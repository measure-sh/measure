package sh.measure.android.tracing

/**
 * Represents a span in a trace.
 */
interface Span {
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
     * Set the status of the span. Signifies whether the operation performed as part of the
     * span was successful or not.
     *
     * @return the updated span.
     */
    fun setStatus(status: SpanStatus): Span

    /**
     * Ends the span.
     *
     * A span can only be ended once. Attempt to end an already ended span is no-op.
     */
    fun end(): Span

    /**
     * Ends the span and sets the [timeMs] as it's end time. Useful if a span is being collected
     * for an operation that already ended.
     *
     * A span can only be ended once. Attempt to end an already ended span is a no-op.
     *
     * @param timeMs The milliseconds since epoch when the span ended.
     */
    fun end(timeMs: Long): Span

    /**
     * Returns whether the span has ended or not.
     */
    fun hasEnded(): Boolean

    /**
     * Puts this span in scope. Putting in scope means putting the span in thread local. Any spans
     * created on this thread will now have this span set as it's parent automatically.
     */
    fun makeCurrent(): Scope

    companion object {

        /**
         * Returns the current span from thread local if any.
         */
        internal fun current(): Span? {
            return SpanStorage.instance.current()
        }
    }
}
