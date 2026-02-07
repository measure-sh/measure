import type { Logger } from '../utils/logger';
import type { TimeProvider } from '../utils/timeProvider';
import type { IConfigProvider } from '../config/configProvider';
import { EventType } from './eventType';
import {
  validateAttributes,
  type ValidAttributeValue,
} from '../utils/attributeValueValidator';
import type { ISignalProcessor } from './signalProcessor';

export interface ICustomEventCollector {
  /** Enables the collector. */
  register(): void;

  /** Disables the collector. */
  unregister(): void;

  /** Checks if the collector is currently enabled. */
  isEnabled(): boolean;

  /**
   * Tracks a custom user-triggered event.
   * @param name The name of the custom event.
   * @param attributes Optional map of custom attributes.
   * @param timestamp Optional custom timestamp.
   */
  trackCustomEvent(
    name: string,
    attributes?: Record<string, ValidAttributeValue>,
    timestamp?: number
  ): Promise<void>;
}
export class CustomEventCollector implements ICustomEventCollector {
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

  async trackCustomEvent(
    name: string,
    attributes?: Record<string, ValidAttributeValue>,
    timestamp?: number
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!name || name.length === 0) {
      this.logger.log('error', 'Invalid event: name is empty');
      return;
    }

    if (name.length > this.configProvider.maxEventNameLength) {
      this.logger.log(
        'error',
        `Invalid event(${name}): exceeds maximum length of ${this.configProvider.maxEventNameLength} characters`
      );
      return;
    }

    const regex = new RegExp(this.configProvider.customEventNameRegex);
    if (!regex.test(name)) {
      this.logger.log('error', `Invalid event(${name}) format`);
      return;
    }

    const isValidAttributes = validateAttributes(attributes ?? {});
    if (!isValidAttributes) {
      this.logger.log(
        'error',
        `Invalid attributes provided for event(${name}). Dropping the event.`
      );
      return;
    }

    try {
      await this.signalProcessor.trackEvent(
        { name },
        EventType.Custom,
        timestamp ?? this.timeProvider.now(),
        {},
        attributes,
        true,
        undefined,
        undefined,
        []
      );

      this.logger.log('info', `Successfully tracked custom event: ${name}`);
    } catch (err) {
      this.logger.log('error', `Failed to track custom event ${name}: ${err}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
