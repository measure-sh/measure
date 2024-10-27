package sh.measure.android.tracing

/**
 * Specifies the status of the operation for which the span has been created.
 */
internal enum class SpanStatus {
    /**
     * The operation completed successfully.
     */
    Ok,

    /**
     * The operation ended in a failure.
     */
    Error,

    /**
     * Default value for all spans.
     */
    Unset,
}
