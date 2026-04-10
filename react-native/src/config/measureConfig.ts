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

  /**
   * Override all sampling configs and track all events and traces.
   * **Note** that enabling this flag can significantly increase the cost and should typically only be enabled for debug mode.
   */
  enableFullCollectionMode: boolean;

  /**
   * Enables diagnostic mode which writes all SDK logs to a file. The log file can be attached
   * when reporting a bug to help with debugging SDK issues.
   *
   * Defaults to `false`.
   *
   * To pull all log files from an android device:
   * ```
   * adb shell "run-as <your.package.name> tar cf - files/measure/sdk_debug_logs/" | tar xf - -C /tmp/
   * ```
   * To pull all log files from an iOS device, you can enable the `enableDiagnosticModeGesture` option on MeasureConfig.
   * This will allow you to trigger share sheet when you use the double finger double tap gesture.
   */
  enableDiagnosticMode: boolean;
}

/**
 * Default implementation of the MeasureConfigInterface.
 */
export class MeasureConfig implements IMeasureConfig {
  enableLogging: boolean;
  autoStart: boolean;
  enableFullCollectionMode: boolean;
  enableDiagnosticMode: boolean;

  /**
   * Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
   *
   * @param enableLogging Enable or disable internal SDK logs. Defaults to `false`.
   * @param autoStart Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
   * @param enableFullCollectionMode Override all sampling configs and track all events and traces.
   * @param enableDiagnosticMode Enables diagnostic mode which writes all SDK logs to a file.
   */
  constructor(options: Partial<IMeasureConfig> = {}) {
    this.enableLogging = options.enableLogging ?? DefaultConfig.enableLogging;
    this.autoStart = options.autoStart ?? DefaultConfig.autoStart;
    this.enableFullCollectionMode =
      options.enableFullCollectionMode ??
      DefaultConfig.enableFullCollectionMode;
    this.enableDiagnosticMode =
      options.enableDiagnosticMode ?? DefaultConfig.enableDiagnosticMode;
  }
}
