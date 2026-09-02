import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/exception/exception_factory.dart';
import 'package:measure_flutter/src/exception/exception_severity.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../events/event_type.dart';

final class ExceptionCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  final TimeProvider timeProvider;
  bool _enabled = false;

  ExceptionCollector({
    required this.logger,
    required this.signalProcessor,
    required this.timeProvider,
  });

  void register() {
    _enabled = true;
  }

  void unregister() {
    _enabled = false;
  }

  Future<void> trackError(
    FlutterErrorDetails details, {
    required ExceptionSeverity severity,
    required Map<String, AttributeValue> attributes,
  }) async {
    if (!_enabled) return;
    final ExceptionData? exceptionData =
        ExceptionFactory.from(details, severity);
    if (exceptionData == null) {
      logger.log(LogLevel.error, "Failed to parse exception");
      return;
    }

    // No screenshot is captured. An uncaught Flutter error can fire on every frame,
    // and capture happens here in Dart before native applies sampling, so a lower
    // sampling rate cannot throttle it.
    return signalProcessor.trackEvent(
      data: exceptionData,
      type: EventType.exception,
      timestamp: timeProvider.now(),
      userDefinedAttrs: attributes,
      userTriggered: false,
      threadName: Isolate.current.debugName,
      attachments: const [],
    );
  }

  @visibleForTesting
  bool isEnabled() {
    return _enabled;
  }
}
