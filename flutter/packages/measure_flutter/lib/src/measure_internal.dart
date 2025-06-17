import 'package:flutter/foundation.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/exception/exception_collector.dart';
import 'package:measure_flutter/src/http/http_collector.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';

import 'config/config_provider.dart';

final class MeasureInternal {
  final MeasureInitializer initializer;
  final Logger logger;
  final ConfigProvider configProvider;
  final CustomEventCollector _customEventCollector;
  final ExceptionCollector _exceptionCollector;
  final NavigationCollector _navigationCollector;
  final HttpCollector _httpCollector;
  final MsrMethodChannel methodChannel;

  MeasureInternal({
    required this.initializer,
    required this.methodChannel,
  })  : logger = initializer.logger,
        configProvider = initializer.configProvider,
        _customEventCollector = initializer.customEventCollector,
        _exceptionCollector = initializer.exceptionCollector,
        _httpCollector = initializer.httpCollector,
        _navigationCollector = initializer.navigationCollector;

  Future<void> init() async {
    if (configProvider.autoStart) {
      registerCollectors();
    }
  }

  void registerCollectors() {
    _exceptionCollector.register();
    _customEventCollector.register();
    _httpCollector.register();
    _navigationCollector.register();
  }

  void unregisterCollectors() {
    _exceptionCollector.unregister();
    _customEventCollector.unregister();
    _httpCollector.unregister();
    _navigationCollector.unregister();
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
    methodChannel.triggerNativeCrash();
  }

  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
  }) {
    _navigationCollector.trackScreenViewEvent(
        name: name, userTriggered: userTriggered);
  }

  void trackHttpEvent({
    required String url,
    required String method,
    int? statusCode,
    int? startTime,
    int? endTime,
    String? failureReason,
    String? failureDescription,
    Map<String, String>? requestHeaders,
    Map<String, String>? responseHeaders,
    String? requestBody,
    String? responseBody,
    String? client,
  }) {
    _httpCollector.trackHttpEvent(
      url: url,
      method: method,
      statusCode: statusCode,
      startTime: startTime,
      endTime: endTime,
      failureReason: failureReason,
      failureDescription: failureDescription,
      requestHeaders: requestHeaders,
      responseHeaders: responseHeaders,
      requestBody: requestBody,
      responseBody: responseBody,
      client: client,
    );
  }

  Future<void> start() async {
    registerCollectors();
    return methodChannel.start();
  }

  Future<void> stop() async {
    unregisterCollectors();
    return methodChannel.stop();
  }
}
