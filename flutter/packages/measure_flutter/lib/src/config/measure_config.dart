import 'package:measure_flutter/measure_flutter.dart';

import 'default_config.dart';


abstract class IMeasureConfig {
  bool get enableLogging;
  bool get autoStart;
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

  /// Creates a new MeasureConfig instance
  const MeasureConfig({
    this.enableLogging = DefaultConfig.enableLogging,
    this.autoStart = DefaultConfig.autoStart,
  });
}
