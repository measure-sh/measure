/**
 * Internal configuration options for the Measure SDK.
 */
export interface InternalConfig {
  /**
   * The maximum length of a custom event. Defaults to 64 chars.
   */
  maxEventNameLength: number;

  /**
   * The regex to validate a custom event name.
   */
  customEventNameRegex: string;

  /**
   * Max length of a span name. Defaults to 64.
   */
  maxSpanNameLength: number;

  /**
   * Max length of a checkpoint name. Defaults to 64.
   */
  maxCheckpointNameLength: number;

  /**
   * Max checkpoints per span. Defaults to 100.
   */
  maxCheckpointsPerSpan: number;
}
