package sh.measure.android.tracing

/**
 * Specifies the status of the operation for which the span has been created.
 *
 * @param value The value to use when marshalling this enum.
 */
enum class SpanStatus(val value: Int) {
    /**
     * Default value for all spans.
     */
    Unset(0),

    /**
     * The operation completed successfully.
     */
    Ok(1),

    /**
     * The operation ended in a failure.
     */
    Error(2),
}
