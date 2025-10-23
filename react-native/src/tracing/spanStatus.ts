/**
 * Specifies the status of the operation for which the span has been created.
 */
export enum SpanStatus {
    /**
     * Default value for all spans.
     */
    Unset = 0,

    /**
     * The operation completed successfully.
     */
    Ok = 1,

    /**
     * The operation ended in a failure.
     */
    Error = 2,
}