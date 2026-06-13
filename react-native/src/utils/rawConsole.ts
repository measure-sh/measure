export type ConsoleLike = Pick<
  Console,
  'debug' | 'log' | 'info' | 'warn' | 'error'
>;

let current: ConsoleLike | null = null;

/**
 * Console writer for all SDK output. While `ConsoleLogCollector` has the
 * console patched, this delegates to the saved unpatched methods so SDK
 * output can never be captured as an app log event. Otherwise it delegates
 * to the live global console.
 */
export const rawConsole: ConsoleLike = {
  debug: (...args: unknown[]) => (current ?? console).debug(...args),
  log: (...args: unknown[]) => (current ?? console).log(...args),
  info: (...args: unknown[]) => (current ?? console).info(...args),
  warn: (...args: unknown[]) => (current ?? console).warn(...args),
  error: (...args: unknown[]) => (current ?? console).error(...args),
};

export function setRawConsole(consoleLike: ConsoleLike | null): void {
  current = consoleLike;
}
