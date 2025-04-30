import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';

class NoopLogger extends Logger {
  @override
  bool get enabled => true;

  @override
  void log(LogLevel level, String message,
      [Object? error, StackTrace? stackTrace]) {
    // No-op
  }
}
