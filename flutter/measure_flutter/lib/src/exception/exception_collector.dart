import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/exception/exception_factory.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';

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

  void trackFlutterError(Object error, StackTrace? stack) {
    if (!enabled) return;
    var timestamp = DateTime.now();
    final ExceptionData exceptionData =
        ExceptionFactory.from(error, stack);
    var serializedExceptionData = exceptionData.toJson();
    signalProcessor.trackFlutterError(serializedExceptionData, timestamp);
  }
}
