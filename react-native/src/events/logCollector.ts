import { setInternalConsole, type LogConsole } from '../utils/internalConsole';
import type { Logger } from '../utils/logger';
import type { TimeProvider } from '../utils/timeProvider';
import type { IConfigProvider } from '../config/configProvider';
import { EventType } from './eventType';
import { LogSeverity, severityNumberOf } from './logSeverity';
import {
  validateAttributes,
  type ValidAttributeValue,
} from '../utils/attributeValueValidator';
import type { ISignalProcessor } from './signalProcessor';

type ConsoleMethodName = 'debug' | 'log' | 'info' | 'warn' | 'error';

const consoleMethodNames: ConsoleMethodName[] = [
  'debug',
  'log',
  'info',
  'warn',
  'error',
];

const severityForMethodName: Record<ConsoleMethodName, LogSeverity> = {
  debug: LogSeverity.Debug,
  log: LogSeverity.Info,
  info: LogSeverity.Info,
  warn: LogSeverity.Warning,
  error: LogSeverity.Error,
};

function safeStringify(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    const json = JSON.stringify(arg);
    return json === undefined ? String(arg) : json;
  } catch {
    return String(arg);
  }
}

export interface ILogCollector {
  /** Enables the collector and captures console output as log events. */
  register(): void;

  /** Disables the collector and restores the original console methods. */
  unregister(): void;

  /**
   * Tracks a log with a severity level.
   * @param params.body The log body to track.
   * @param params.severity The severity of the log, defaults to info.
   * @param params.attributes Optional map of custom attributes.
   * @param params.userTriggered Whether the log was tracked by the user, defaults to true.
   */
  trackLog(params: {
    body: string;
    severity?: LogSeverity;
    attributes?: Record<string, ValidAttributeValue>;
    userTriggered?: boolean;
  }): void;
}

/**
 * Collects logs from the manual `Measure.log` API and from captured `console`
 * output (debug, log, info, warn, error).
 */
export class LogCollector implements ILogCollector {
  private logger: Logger;
  private timeProvider: TimeProvider;
  private configProvider: IConfigProvider;
  private signalProcessor: ISignalProcessor;
  private enabled = false;
  private originalConsole: LogConsole | null = null;
  private captureInProgress = false;

  constructor(opts: {
    logger: Logger;
    timeProvider: TimeProvider;
    configProvider: IConfigProvider;
    signalProcessor: ISignalProcessor;
  }) {
    this.logger = opts.logger;
    this.timeProvider = opts.timeProvider;
    this.configProvider = opts.configProvider;
    this.signalProcessor = opts.signalProcessor;
  }

  register(): void {
    this.enabled = true;
    this.wrapConsole();
  }

  unregister(): void {
    this.enabled = false;
    this.restoreConsole();
  }

  trackLog({
    body,
    severity,
    attributes,
    userTriggered,
  }: {
    body: string;
    severity?: LogSeverity;
    attributes?: Record<string, ValidAttributeValue>;
    userTriggered?: boolean;
  }): void {
    if (!this.enabled) {
      this.logger.internalLog(
        'warning',
        'Measure SDK is stopped. log() will be ignored.'
      );
      return;
    }

    if (!body || body.length === 0) {
      this.logger.log('error', 'Invalid log: body is empty');
      return;
    }

    const resolvedSeverity = severity ?? LogSeverity.Info;
    const severityNumber = severityNumberOf(resolvedSeverity);
    if (severityNumber < this.configProvider.logMinSeverity) {
      return;
    }

    if (this.configProvider.shouldDiscardLog(body)) {
      return;
    }

    const isValidAttributes = validateAttributes(attributes ?? {});
    if (!isValidAttributes) {
      this.logger.log(
        'error',
        'Invalid attributes provided for log. Dropping the event.'
      );
      return;
    }

    const logData = {
      severity_text: resolvedSeverity,
      severity_number: severityNumber,
      body: body.slice(0, this.configProvider.maxLogBodyLength),
    };

    this.signalProcessor
      .trackEvent(
        logData,
        EventType.Log,
        this.timeProvider.now(),
        {},
        attributes,
        userTriggered ?? true,
        undefined,
        undefined,
        []
      )
      .catch((err) => {
        this.logger.log('error', `Failed to track log: ${err}`);
      });
  }

  private wrapConsole(): void {
    if (this.originalConsole) {
      return;
    }
    // Remember the original methods, then replace each with a wrapper that still
    // prints via the original and also captures the call as a log event.
    const originalConsole: LogConsole = {
      debug: console.debug,
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    consoleMethodNames.forEach((methodName) => {
      console[methodName] = (...args: unknown[]) => {
        originalConsole[methodName].apply(console, args);
        this.captureConsoleCall(methodName, args);
      };
    });
    this.originalConsole = originalConsole;
    // Point the SDK's own logging back to the original methods
    setInternalConsole(originalConsole);
  }

  private restoreConsole(): void {
    const originalConsole = this.originalConsole;
    if (!originalConsole) {
      return;
    }
    // Put the original methods back
    consoleMethodNames.forEach((methodName) => {
      console[methodName] = originalConsole[methodName];
    });
    this.originalConsole = null;
    setInternalConsole(null);
  }

  private captureConsoleCall(
    methodName: ConsoleMethodName,
    args: unknown[]
  ): void {
    if (this.captureInProgress || !this.configProvider.logAutocollectEnabled) {
      return;
    }

    // Skip Error arguments: exceptions are captured by the exception APIs, so
    // logging them here would duplicate them.
    const body = args
      .filter((arg) => !(arg instanceof Error))
      .map(safeStringify)
      .join(' ');
    if (body.length === 0) {
      return;
    }

    this.captureInProgress = true;
    try {
      this.trackLog({
        body,
        severity: severityForMethodName[methodName],
        userTriggered: false,
      });
    } finally {
      this.captureInProgress = false;
    }
  }
}
