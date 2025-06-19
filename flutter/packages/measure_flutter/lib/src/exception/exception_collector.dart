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
  bool _enabled = false;

  ExceptionCollector({
    required this.logger,
    required this.signalProcessor,
  });

  void register() {
    _enabled = true;
  }

  void unregister() {
    _enabled = false;
  }

  Future<void> trackError(
    FlutterErrorDetails details, {
    required bool handled,
  }) async {
    if (!_enabled) return;
    final ExceptionData? exceptionData =
        ExceptionFactory.from(details, handled);
    if (exceptionData == null) {
      logger.log(LogLevel.error, "Failed to parse exception");
      return;
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

  @visibleForTesting
  bool isEnabled() {
    return _enabled;
  }
}
