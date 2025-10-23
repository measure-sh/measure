/**
 * Represents a checkpoint in a span's lifecycle.
 */
export interface Checkpoint {
    /**
     * The name of the checkpoint.
     */
    name: string;

    /**
     * The timestamp when the checkpoint was created.
     * Often represented as an ISO 8601 string or a numeric timestamp.
     */
    timestamp: string;
}