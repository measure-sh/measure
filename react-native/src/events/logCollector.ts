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

export interface ILogCollector {
  /** Enables the collector. */
  register(): void;

  /** Disables the collector. */
  unregister(): void;

  /** Checks if the collector is currently enabled. */
  isEnabled(): boolean;

  /**
   * Tracks a log with a severity level.
   * @param params.body The log body to track.
   * @param params.severity The severity of the log, defaults to info.
   * @param params.attributes Optional map of custom attributes.
   * @param params.timestamp Optional custom timestamp.
   * @param params.userTriggered Whether the log was tracked by the user, defaults to true.
   */
  trackLog(params: {
    body: string;
    severity?: LogSeverity;
    attributes?: Record<string, ValidAttributeValue>;
    timestamp?: number;
    userTriggered?: boolean;
  }): Promise<void>;
}

export class LogCollector implements ILogCollector {
  private logger: Logger;
  private timeProvider: TimeProvider;
  private configProvider: IConfigProvider;
  private enabled = false;
  private signalProcessor: ISignalProcessor;

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
  }

  unregister(): void {
    this.enabled = false;
  }

  async trackLog({
    body,
    severity,
    attributes,
    timestamp,
    userTriggered,
  }: {
    body: string;
    severity?: LogSeverity;
    attributes?: Record<string, ValidAttributeValue>;
    timestamp?: number;
    userTriggered?: boolean;
  }): Promise<void> {
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
    if (
      severityNumberOf(resolvedSeverity) <
      this.configProvider.minLogSeverityNumber
    ) {
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

    try {
      await this.signalProcessor.trackEvent(
        {
          severity_text: resolvedSeverity,
          severity_number: severityNumberOf(resolvedSeverity),
          body: body.slice(0, this.configProvider.maxLogMessageLength),
        },
        EventType.Log,
        timestamp ?? this.timeProvider.now(),
        {},
        attributes,
        userTriggered ?? true,
        undefined,
        undefined,
        []
      );

      this.logger.log('info', 'Successfully tracked log');
    } catch (err) {
      this.logger.log('error', `Failed to track log: ${err}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
