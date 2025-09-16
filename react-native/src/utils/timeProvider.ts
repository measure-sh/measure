/**
 * Provides current time.
 */
export interface TimeProvider {
  /**
   * Returns a time measurement with millisecond precision that can only be used
   * to calculate time intervals.
   */
  readonly elapsedRealtime: number;

  /**
   * Returns the current epoch timestamp in millis.
   * This is anchored at initialization and stable against clock skew.
   */
  now(): number;

  /**
   * Returns an ISO 8601 timestamp string for the given epoch millis.
   */
  iso8601Timestamp(timeInMillis: number): string;
}

/**
 * Implementation of TimeProvider for React Native/JS runtimes.
 */
export class MeasureTimeProvider implements TimeProvider {
  private readonly anchoredEpochTime: number;
  private readonly anchoredElapsedRealtime: number;

  constructor() {
    this.anchoredEpochTime = Date.now();
    this.anchoredElapsedRealtime = performance.now();
  }

  get elapsedRealtime(): number {
    return performance.now();
  }

  now(): number {
    return this.anchoredEpochTime + (performance.now() - this.anchoredElapsedRealtime);
  }

  iso8601Timestamp(timeInMillis: number): string {
    return new Date(timeInMillis).toISOString();
  }
}