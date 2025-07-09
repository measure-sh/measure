import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:measure_flutter/src/attribute_value.dart';
import 'package:measure_flutter/src/bug_report/bug_report_collector.dart';
import 'package:measure_flutter/src/bug_report/shake_detector.dart';
import 'package:measure_flutter/src/bug_report/ui/bug_report_theme.dart';
import 'package:measure_flutter/src/events/attachment_type.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/events/msr_attachment.dart';
import 'package:measure_flutter/src/exception/exception_collector.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/gesture_collector.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/http/http_collector.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';
import 'package:measure_flutter/src/screenshot/screenshot_collector.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/tracing/span.dart';
import 'package:measure_flutter/src/tracing/span_builder.dart';
import 'package:measure_flutter/src/tracing/tracer.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import 'config/config_provider.dart';
import 'gestures/scroll_data.dart';

final class MeasureInternal {
  final MeasureInitializer initializer;
  final Logger logger;
  final ConfigProvider configProvider;
  final CustomEventCollector _customEventCollector;
  final ExceptionCollector _exceptionCollector;
  final NavigationCollector _navigationCollector;
  final HttpCollector _httpCollector;
  final BugReportCollector _bugReportCollector;
  final GestureCollector _gestureCollector;
  final ScreenshotCollector _screenshotCollector;
  final Tracer _tracer;
  final TimeProvider _timeProvider;
  final MsrMethodChannel methodChannel;
  final IdProvider _idProvider;
  final ShakeDetector _shakeDetector;

  MeasureInternal({
    required this.initializer,
    required this.methodChannel,
  })  : logger = initializer.logger,
        configProvider = initializer.configProvider,
        _customEventCollector = initializer.customEventCollector,
        _exceptionCollector = initializer.exceptionCollector,
        _httpCollector = initializer.httpCollector,
        _navigationCollector = initializer.navigationCollector,
        _bugReportCollector = initializer.bugReportCollector,
        _gestureCollector = initializer.gestureCollector,
        _screenshotCollector = initializer.screenshotCollector,
        _timeProvider = initializer.timeProvider,
        _tracer = initializer.tracer,
        _idProvider = initializer.idProvider,
        _shakeDetector = initializer.shakeDetector;

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
    _bugReportCollector.register();
    _shakeDetector.register();
    _gestureCollector.register();
  }

  void unregisterCollectors() {
    _exceptionCollector.unregister();
    _customEventCollector.unregister();
    _httpCollector.unregister();
    _navigationCollector.unregister();
    _bugReportCollector.unregister();
    _shakeDetector.unregister();
    _gestureCollector.unregister();
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

  SpanBuilder createSpanBuilder(String name) {
    return _tracer.spanBuilder(name);
  }

  String getTraceParentHeaderKey() {
    return _tracer.getTraceParentHeaderKey();
  }

  String getTraceParentHeaderValue(Span span) {
    return _tracer.getTraceParentHeaderValue(span);
  }

  int getCurrentTime() {
    return _timeProvider.now();
  }

  Future<void> setUserId(String userId) {
    return methodChannel.setUserId(userId);
  }

  Future<void> clearUserId() {
    return methodChannel.clearUserId();
  }

  Future<String?> getSessionId() {
    return methodChannel.getSessionId();
  }

  void trackBugReport(String description, List<MsrAttachment> attachments,
      Map<String, AttributeValue> attributes) {
    _bugReportCollector.trackBugReport(description, attachments, attributes);
  }

  Future<MsrAttachment?> captureScreenshot() {
    return _screenshotCollector.capture();
  }

  MsrAttachment? getAttachment(Uint8List bytes, AttachmentType type) {
    final id = _idProvider.uuid();
    return MsrAttachment.fromBytes(bytes: bytes, type: type, uuid: id);
  }

  Widget createBugReport({
    Key? key,
    required MsrAttachment? screenshot,
    required BugReportTheme theme,
    required Map<String, AttributeValue>? attributes,
  }) {
    return _bugReportCollector.createBugReport(
        key: key, screenshot: screenshot, theme: theme, attributes: attributes);
  }

  void setShakeListener(Function? onShake) {
    _shakeDetector.setShakeListener(onShake);
  }

  void trackClick(ClickData clickData) {
    _gestureCollector.trackGestureClick(clickData);
  }

  void trackLongClick(LongClickData longClickData) {
    _gestureCollector.trackGestureLongClick(longClickData);
  }

  void trackScroll(ScrollData scrollData) {
    _gestureCollector.trackGestureScroll(scrollData);
  }
}
