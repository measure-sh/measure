import 'dart:async';
import 'dart:developer' as developer;

import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_platform_interface.dart';

const String _platformFlutter = 'flutter';

final class FlutterLogger implements Logger {
  @override
  final bool enabled;
  final bool enableDiagnosticMode;

  const FlutterLogger({
    required this.enabled,
    this.enableDiagnosticMode = false,
  });

  @override
  void log(LogLevel level, String message,
      [dynamic error, StackTrace? stackTrace]) {
    if (enabled) {
      developer.log(
        message,
        level: level.level,
        error: error,
        stackTrace: stackTrace,
        name: "Measure",
      );
    }
    if (enableDiagnosticMode) {
      final composed = StringBuffer(message);
      if (error != null) {
        composed.write('\n');
        composed.write(error.toString());
      }
      if (stackTrace != null) {
        composed.write('\n');
        composed.write(stackTrace.toString());
      }
      unawaited(
        MeasureFlutterPlatform.instance
            .internalAddLog(
              platform: _platformFlutter,
              message: composed.toString(),
            )
            .catchError((_) {}),
      );
    }
  }
}
