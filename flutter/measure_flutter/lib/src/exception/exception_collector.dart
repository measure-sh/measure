import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:stack_trace/stack_trace.dart';

final class ExceptionCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  bool enabled = false;

  ExceptionCollector({
    required this.logger,
    required this.signalProcessor,
  });

  void register() {
    enabled = true;
  }

  void unregister() {
    enabled = false;
  }

  void trackFlutterError(
      Object exception, StackTrace? stack) {
    final Trace trace = Trace.parseVM(stack.toString()).terse;
    logger.log(LogLevel.debug, trace.frames.join("\n"));
  }
}
