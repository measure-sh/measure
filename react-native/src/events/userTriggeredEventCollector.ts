import { validateAttributes, type ValidAttributeValue } from '../utils/attributeValueValidator';
import type { Logger } from '../utils/logger';
import type { TimeProvider } from '../utils/timeProvider';
import { EventType } from './eventType';
import type { ISignalProcessor } from './signalProcessor';

/**
 * Interface for tracking user-triggered events like screen views or user errors.
 */
export interface IUserTriggeredEventCollector {
  /**
   * Registers (enables) the collector to start tracking events.
   */
  register(): void;

  /**
   * Unregisters (disables) the collector to stop tracking events.
   */
  unregister(): void;

  /**
   * Tracks a screen view event with optional attributes.
   *
   * @param screenName - The name of the screen being viewed.
   * @param attributes - Optional key-value pairs providing context.
   * @param timestamp - Optional timestamp in milliseconds (defaults to now).
   */
  trackScreenView(
    screenName: string,
    attributes?: Record<string, ValidAttributeValue>,
    timestamp?: number
  ): Promise<void>;

  /**
   * Returns whether the collector is currently enabled.
   */
  isEnabled(): boolean;
}

export class UserTriggeredEventCollector implements IUserTriggeredEventCollector {
  private logger: Logger;
  private timeProvider: TimeProvider;
  private enabled = false;
  private signalProcessor: ISignalProcessor;

  constructor(opts: {
    logger: Logger;
    timeProvider: TimeProvider;
    signalProcessor: ISignalProcessor;
  }) {
    this.logger = opts.logger;
    this.timeProvider = opts.timeProvider;
    this.signalProcessor = opts.signalProcessor;
  }

  register(): void {
    this.enabled = true;
  }

  unregister(): void {
    this.enabled = false;
  }

  async trackScreenView(
    screenName: string,
    attributes?: Record<string, ValidAttributeValue>
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!screenName || screenName.length === 0) {
      this.logger.log('error', 'Invalid screen view: name is empty');
      return;
    }

    const isValidAttributes = validateAttributes(attributes ?? {});
    if (!isValidAttributes) {
      this.logger.log(
        'error',
        `Invalid attributes provided for event(${screenName}). Dropping the event.`
      );
      return;
    }

    try {
      this.signalProcessor.trackEvent(
        { name: screenName },
        EventType.ScreenView,
        this.timeProvider.now(),
        {},
        attributes,
        true,
        undefined,
        undefined,
        []
      );

      this.logger.log('info', `Successfully tracked screen view: ${screenName}`);
    } catch (err) {
      this.logger.log('error', `Failed to track screen view ${screenName}: ${err}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}