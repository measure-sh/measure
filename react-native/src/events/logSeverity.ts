/**
 * Severity of a log tracked using `Measure.log`.
 */
export enum LogSeverity {
  Debug = 'debug',
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Fatal = 'fatal',
}

/**
 * Numeric severity for each level, used to order and filter logs. Each level
 * maps to the highest number in its severity band.
 */
const severityNumber: Record<LogSeverity, number> = {
  [LogSeverity.Debug]: 8,
  [LogSeverity.Info]: 12,
  [LogSeverity.Warning]: 16,
  [LogSeverity.Error]: 20,
  [LogSeverity.Fatal]: 24,
};

/**
 * Returns the numeric severity of a level. Unrecognized values fall back to the
 * number for `info`.
 */
export function severityNumberOf(value: string): number {
  return severityNumber[value as LogSeverity] ?? severityNumber[LogSeverity.Info];
}
