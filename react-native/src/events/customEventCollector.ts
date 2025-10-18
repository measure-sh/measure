import type { Logger } from '../utils/logger';
import { trackEvent as nativeTrackEvent } from '../native/measureBridge';
import type { TimeProvider } from '../utils/timeProvider';
import type { ConfigProvider } from '../config/configProvider';
import { EventType } from './eventType';
import {
  validateAttributes,
  type ValidAttributeValue,
} from '../utils/attributeValueValidator';

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
  private configProvider: ConfigProvider;
  private enabled = false;

  constructor(opts: {
    logger: Logger;
    timeProvider: TimeProvider;
    configProvider: ConfigProvider;
  }) {
    this.logger = opts.logger;
    this.timeProvider = opts.timeProvider;
    this.configProvider = opts.configProvider;
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
      await nativeTrackEvent(
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
