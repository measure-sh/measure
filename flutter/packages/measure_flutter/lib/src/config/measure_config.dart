import 'package:measure_flutter/measure_flutter.dart';

import 'default_config.dart';

abstract class IMeasureConfig {
  bool get enableLogging;

  bool get autoStart;

  bool get enableDiagnosticMode;

  Map<Type, String> get widgetFilter;
}

class MeasureConfig implements IMeasureConfig {
  /// Enable or disable internal SDK logs. Defaults to `false`.
  @override
  final bool enableLogging;

  /// Set to false to delay starting the SDK, by default initializing the SDK also starts tracking.
  ///
  /// Defaults to true.
  ///
  /// @see [Measure.start] to start the SDK.
  @override
  final bool autoStart;

  /// Enables diagnostic mode which writes all SDK logs to a file. The log file can be attached
  /// when reporting a bug to help with debugging SDK issues.
  ///
  /// Defaults to `false`.
  ///
  /// To pull all log files from an Android device:
  /// ```
  /// adb shell "run-as <your.package.name> tar czf - files/measure/sdk_debug_logs/" > sdk_debug_logs.tar.gz
  /// ```
  /// On iOS, set `enableDiagnosticModeGesture` on the native `MeasureConfig` (in your AppDelegate)
  /// to trigger the share sheet via the double finger double tap gesture.
  @override
  final bool enableDiagnosticMode;

  @override
  final Map<Type, String> widgetFilter;

  /// Creates a new MeasureConfig instance
  const MeasureConfig({
    this.enableLogging = DefaultConfig.enableLogging,
    this.autoStart = DefaultConfig.autoStart,
    this.enableDiagnosticMode = DefaultConfig.enableDiagnosticMode,
    this.widgetFilter = DefaultConfig.widgetFilter,
  });
}
