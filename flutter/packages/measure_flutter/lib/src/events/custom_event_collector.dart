import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:measure_flutter/src/attribute_value.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../logger/log_level.dart';

final class CustomEventCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  final TimeProvider timeProvider;
  final ConfigProvider configProvider;
  bool _enabled = false;

  CustomEventCollector({
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

  void trackCustomEvent(
    String name,
    int? timestamp,
    Map<String, AttributeValue> attributes,
  ) {
    if (!_enabled) {
      return;
    }

    if (name.isEmpty) {
      logger.log(
        LogLevel.error,
        "Invalid event: name is empty",
      );
      return;
    }

    if (name.length > configProvider.maxEventNameLength) {
      logger.log(
        LogLevel.error,
        "Invalid event($name): name exceeds maximum length of ${configProvider.maxEventNameLength} characters",
      );
      return;
    }

    final RegExp customEventNameRegex =
        RegExp(configProvider.customEventNameRegex);
    if (!customEventNameRegex.hasMatch(name)) {
      logger.log(LogLevel.error, "Invalid event($name) format");
      return;
    }

    signalProcessor.trackEvent(
      data: CustomEventData(name: name),
      type: EventType.custom,
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
