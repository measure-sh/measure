import { setRawConsole } from '../utils/rawConsole';
import type { ILogCollector } from './logCollector';
import { LogSeverity } from './logSeverity';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

const consoleMethods: ConsoleMethod[] = ['log', 'info', 'warn', 'error'];

const severityForMethod: Record<ConsoleMethod, LogSeverity> = {
  log: LogSeverity.Info,
  info: LogSeverity.Info,
  warn: LogSeverity.Warning,
  error: LogSeverity.Error,
};

function safeStringify(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg instanceof Error) {
    return arg.stack ?? String(arg);
  }
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

export interface IConsoleLogCollector {
  /** Patches console methods to capture output as log events. */
  register(): void;

  /** Restores the original console methods. */
  unregister(): void;
}

/**
 * Captures `console.log`, `console.info`, `console.warn` and `console.error`
 * output as log events. The original console methods are always invoked first,
 * so console output is unaffected. While the patch is active the SDK's own
 * output is routed through the saved originals via `rawConsole`, so it can
 * never be captured back as an app log event.
 */
export class ConsoleLogCollector implements IConsoleLogCollector {
  private logCollector: ILogCollector;
  private originals: Partial<
    Record<ConsoleMethod, (...args: unknown[]) => void>
  > = {};
  private enabled = false;
  private capturing = false;

  constructor(opts: { logCollector: ILogCollector }) {
    this.logCollector = opts.logCollector;
  }

  register(): void {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    const saved = {
      debug: console.debug,
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    consoleMethods.forEach((method) => {
      const original = saved[method];
      this.originals[method] = original;
      console[method] = (...args: unknown[]) => {
        original.apply(console, args);
        this.capture(method, args);
      };
    });
    setRawConsole(saved);
  }

  unregister(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    consoleMethods.forEach((method) => {
      const original = this.originals[method];
      if (original) {
        console[method] = original;
      }
    });
    this.originals = {};
    setRawConsole(null);
  }

  private capture(method: ConsoleMethod, args: unknown[]): void {
    if (this.capturing) {
      return;
    }
    const body = args.map(safeStringify).join(' ');
    if (body.length === 0) {
      return;
    }
    this.capturing = true;
    try {
      this.logCollector
        .trackLog({
          body,
          severity: severityForMethod[method],
          userTriggered: false,
        })
        .catch(() => {});
    } finally {
      this.capturing = false;
    }
  }
}
