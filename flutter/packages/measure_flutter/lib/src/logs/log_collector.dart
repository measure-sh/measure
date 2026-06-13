import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:measure_flutter/src/attribute_value.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/logs/log_data.dart';
import 'package:measure_flutter/src/logs/log_severity.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../logger/log_level.dart';

final class LogCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  final TimeProvider timeProvider;
  final ConfigProvider configProvider;
  bool _enabled = false;

  LogCollector({
    required this.logger,
    required this.signalProcessor,
    required this.timeProvider,
    required this.configProvider,
  });

  void register() {
    _enabled = true;
  }

  void unregister() {
    _enabled = false;
  }

  void trackLog(
    String body,
    LogSeverity severity,
    Map<String, AttributeValue> attributes,
    int? timestamp,
  ) {
    if (!_enabled) {
      return;
    }

    if (body.isEmpty) {
      logger.log(
        LogLevel.error,
        "Invalid log: body is empty",
      );
      return;
    }

    if (severity.severityNumber < configProvider.minLogSeverityNumber) {
      return;
    }

    final maxLength = configProvider.maxLogMessageLength;
    final truncatedBody =
        body.length > maxLength ? body.substring(0, maxLength) : body;

    signalProcessor.trackEvent(
      data: LogData(
        severityText: severity.value,
        severityNumber: severity.severityNumber,
        body: truncatedBody,
      ),
      type: EventType.log,
      timestamp: timestamp ?? timeProvider.now(),
      userDefinedAttrs: attributes,
      userTriggered: true,
      threadName: Isolate.current.debugName,
    );
  }

  @visibleForTesting
  bool isEnabled() {
    return _enabled;
  }
}
