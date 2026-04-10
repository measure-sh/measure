import { internalAddLog } from '../native/measureBridge';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface Logger {
  enabled: boolean;
  log: (
    level: LogLevel,
    message: string,
    error?: unknown,
    data?: unknown
  ) => void;
  internalLog: (
    level: LogLevel,
    message: string,
    error?: unknown,
    data?: unknown
  ) => void;
}

export class MeasureLogger implements Logger {
  enabled: boolean;
  private internalLogging: boolean;
  private enableDiagnosticMode: boolean;
  private tag: string;

  constructor(
    tag: string,
    enabled: boolean,
    internalLogging: boolean,
    enableDiagnosticMode: boolean
  ) {
    this.tag = tag;
    this.enabled = enabled;
    this.internalLogging = internalLogging;
    this.enableDiagnosticMode = enableDiagnosticMode;
  }

  log(level: LogLevel, message: string, error?: unknown, data?: unknown) {
    if (!this.enabled) return;

    const prefix = `[${this.tag}]`;
    const dataStr = data ? JSON.stringify(data) : '';
    const errorStr = error
      ? error instanceof Error
        ? error.message
        : String(error)
      : '';
    const output = `${prefix} ${message} ${dataStr} ${errorStr}`.trim();

    if (this.enableDiagnosticMode) {
      const errorStr = error
        ? error instanceof Error
          ? error.message
          : String(error)
        : null;
      internalAddLog('react-native', message, errorStr).catch(() => {});
    }

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warning':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  internalLog(
    level: LogLevel,
    message: string,
    error?: unknown,
    data?: unknown
  ) {
    if (this.internalLogging) {
      this.log(level, `Internal: ${message}`, error, data);
    }
  }
}
