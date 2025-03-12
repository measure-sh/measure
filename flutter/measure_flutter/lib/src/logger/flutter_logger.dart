import 'dart:developer' as developer;

import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/logger/log_level.dart';

final class FlutterLogger implements Logger {
  @override
  final bool enabled;

  const FlutterLogger({required this.enabled});

  @override
  void log(LogLevel level, String message, [dynamic throwable]) {
    if (!enabled) return;
    developer.log(message, level: level.level, error: throwable);
  }
}
