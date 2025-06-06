import 'package:flutter/foundation.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/exception/exception_collector.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';

final class MeasureInternal {
  final MeasureInitializer initializer;
  final Logger logger;
  final CustomEventCollector _customEventCollector;
  final ExceptionCollector _exceptionCollector;
  final NavigationCollector _navigationCollector;
  final MsrMethodChannel _methodChannel;

  MeasureInternal({
    required this.initializer,
  })  : logger = initializer.logger,
        _customEventCollector = initializer.customEventCollector,
        _methodChannel = initializer.methodChannel,
        _exceptionCollector = initializer.exceptionCollector,
        _navigationCollector = initializer.navigationCollector;

  Future<void> init() async {
    registerCollectors();
  }

  void registerCollectors() {
    _exceptionCollector.register();
    _customEventCollector.register();
  }

  void trackCustomEvent(String name, DateTime? timestamp,
      Map<String, AttributeValue> attributes) {
    _customEventCollector.trackCustomEvent(name, timestamp, attributes);
  }

  Future<void> trackError(
    FlutterErrorDetails details, {
    required bool handled,
  }) {
    return _exceptionCollector.trackError(details, handled: handled);
  }

  void triggerNativeCrash() {
    _methodChannel.triggerNativeCrash();
  }

  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
  }) {
    _navigationCollector.trackScreenViewEvent(
        name: name, userTriggered: userTriggered);
  }
}
