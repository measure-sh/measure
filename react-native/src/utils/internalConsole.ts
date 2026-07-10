export type LogConsole = Pick<
  Console,
  'debug' | 'log' | 'info' | 'warn' | 'error'
>;

// The SDK logs through internalConsole so its own logs never hit the wrapper
// LogCollector installs. It always reaches the real console: the saved
// originals while capturing, or the live global console otherwise.
let originalConsole: LogConsole | null = null;

export const internalConsole: LogConsole = {
  debug: (...args: unknown[]) => (originalConsole ?? console).debug(...args),
  log: (...args: unknown[]) => (originalConsole ?? console).log(...args),
  info: (...args: unknown[]) => (originalConsole ?? console).info(...args),
  warn: (...args: unknown[]) => (originalConsole ?? console).warn(...args),
  error: (...args: unknown[]) => (originalConsole ?? console).error(...args),
};

// LogCollector uses this to point internalConsole at the real methods while it
// has the console wrapped, and back to null once it restores them.
export function setInternalConsole(original: LogConsole | null): void {
  originalConsole = original;
}
