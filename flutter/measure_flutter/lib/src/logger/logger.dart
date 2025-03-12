import 'log_level.dart';

abstract class Logger {
  bool get enabled;

  void log(LogLevel level, String message, [Object? error]);
}
