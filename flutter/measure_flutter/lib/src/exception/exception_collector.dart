import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/exception/exception_factory.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';

import '../events/event_type.dart';

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

  Future<void> trackError(
    FlutterErrorDetails details, {
    required bool handled,
  }) {
    if (!enabled) return Future.value();
    final ExceptionData? exceptionData =
        ExceptionFactory.from(details, handled);
    if (exceptionData == null) {
      logger.log(LogLevel.error, "Failed to parse exception");
      return Future.value();
    }
    return signalProcessor.trackEvent(
      data: exceptionData,
      type: EventType.exception,
      timestamp: DateTime.now(),
      userDefinedAttrs: {},
      userTriggered: false,
      threadName: Isolate.current.debugName,
    );
  }
}
