package sh.measure.kmp.tracing

/**
 * Specifies the status of the operation for which the span has been created.
 */
enum class SpanStatus {
    /**
     * Default value for all spans.
     */
    Unset,

    /**
     * The operation completed successfully.
     */
    Ok,

    /**
     * The operation ended in a failure.
     */
    Error,
}
