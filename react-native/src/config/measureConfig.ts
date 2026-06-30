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

  /**
   * An identifier for the current Over-The-Air (OTA) patch. Set this when using OTA update
   * systems (e.g. EAS Update) so that crash stack traces can be symbolicated against the
   * correct source maps uploaded for this patch.
   *
   * The value can be any string, for example the EAS update group ID or a human-readable
   * label like "release v1.0.3". It is optional and only required for apps using OTA updates.
   */
  patchId?: string;
}

/**
 * Default implementation of the MeasureConfigInterface.
 */
export class MeasureConfig implements IMeasureConfig {
  enableLogging: boolean;
  autoStart: boolean;
  enableDiagnosticMode: boolean;
  patchId?: string;

  /**
   * Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
   *
   * @param enableLogging Enable or disable internal SDK logs. Defaults to `false`.
   * @param autoStart Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
   * @param enableDiagnosticMode Enables diagnostic mode which writes all SDK logs to a file.
   * @param patchId Optional OTA patch identifier for sourcemap symbolication.
   */
  constructor(options: Partial<IMeasureConfig> = {}) {
    this.enableLogging = options.enableLogging ?? DefaultConfig.enableLogging;
    this.autoStart = options.autoStart ?? DefaultConfig.autoStart;
    this.enableDiagnosticMode =
      options.enableDiagnosticMode ?? DefaultConfig.enableDiagnosticMode;
    this.patchId = options.patchId;
  }
}
