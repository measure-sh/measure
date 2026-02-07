import { DefaultConfig } from './defaultConfig';

/**
 * Configuration for the Measure SDK. Used to customize the behavior of the SDK on initialization.
 */
export interface IMeasureConfig {
  /**
   * Whether to enable internal SDK logging.
   * Defaults to `false`.
   */
  enableLogging: boolean;

  /**
   * Whether to automatically start the SDK on initialization.
   * Set to false to delay starting the SDK. By default, initializing the SDK also starts tracking.
   * Defaults to true.
   */
  autoStart: boolean;
}

/**
 * Default implementation of the MeasureConfigInterface.
 */
export class MeasureConfig implements IMeasureConfig {
  enableLogging: boolean;
  autoStart: boolean;

  /**
   * Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
   *
   * @param enableLogging Enable or disable internal SDK logs. Defaults to `false`.
   * @param autoStart Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
   */
  constructor(options: Partial<IMeasureConfig> = {}) {
    this.enableLogging = options.enableLogging ?? DefaultConfig.enableLogging;
    this.autoStart = options.autoStart ?? DefaultConfig.autoStart;
  }
}
