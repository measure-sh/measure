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
}