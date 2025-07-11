import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/measure_internal.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

import 'measure_flutter.dart';

export 'src/attribute_builder.dart';
export 'src/attribute_value.dart';
export 'src/bug_report/msr_shake_detector_mixin.dart';
export 'src/bug_report/ui/bug_report_theme.dart';
export 'src/config/client.dart';
export 'src/config/measure_config.dart';
export 'src/events/attachment_type.dart';
export 'src/events/msr_attachment.dart';
export 'src/gestures/msr_gesture_detector.dart';
export 'src/http/http_method.dart';
export 'src/measure_api.dart';
export 'src/measure_widget.dart';
export 'src/navigation/navigator_observer.dart';
export 'src/tracing/span.dart';
export 'src/tracing/span_builder.dart';
export 'src/tracing/span_status.dart';

/// Main Measure SDK class implementing MeasureApi
/// Provides a singleton interface for tracking events, errors, and HTTP requests
class Measure implements MeasureApi {
  Measure._();

  /// Named constructor for testing with injectable method channel
  @visibleForTesting
  Measure.withMethodChannel(this._methodChannel);

  static final Measure instance = Measure._();

  late MeasureInternal _measure;
  bool _isInitialized = false;
  MsrMethodChannel? _methodChannel;

  @visibleForTesting
  bool get isInitialized => _isInitialized;

  @override
  Future<void> init(
    FutureOr<void> Function() action, {
    required ClientInfo clientInfo,
    MeasureConfig config = const MeasureConfig(),
  }) async {
    WidgetsFlutterBinding.ensureInitialized();
    if (_validateClientInfo(clientInfo)) {
      try {
        await _initializeMeasureSDK(config, clientInfo);
        _isInitialized = true;
        _logInitializationSuccess();
        await _setupErrorHandling();
      } catch (e, stackTrace) {
        _logInitializationFailure(config.enableLogging, e, stackTrace);
      }
    }
    return action();
  }

  @override
  Future<void> start() async {
    if (isInitialized) {
      return _measure.start();
    }
  }

  @override
  Future<void> stop() async {
    if (isInitialized) {
      return _measure.stop();
    }
  }

  @override
  bool shouldTrackHttpUrl(String url) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpUrl(url);
    }
    return false;
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpHeader(key);
    }
    return false;
  }

  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpBody(url, contentType);
    }
    return false;
  }

  @override
  void trackEvent({
    required String name,
    Map<String, AttributeValue> attributes = const {},
    int? timestamp,
  }) {
    if (_isInitialized) {
      _measure.trackCustomEvent(name, timestamp, attributes);
    }
  }

  @override
  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
  }) {
    if (_isInitialized) {
      _measure.trackScreenViewEvent(
        name: name,
        userTriggered: userTriggered,
      );
    }
  }

  @override
  void trackHttpEvent({
    required String url,
    required HttpMethod method,
    required int startTime,
    required int endTime,
    int? statusCode,
    String? failureReason,
    String? failureDescription,
    Map<String, String>? requestHeaders,
    Map<String, String>? responseHeaders,
    String? requestBody,
    String? responseBody,
    String? client,
  }) {
    if (_isInitialized) {
      _measure.trackHttpEvent(
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
  }

  @override
  void trackBugReport({
    required String description,
    required List<MsrAttachment> attachments,
    required Map<String, AttributeValue> attributes,
  }) {
    if (_isInitialized) {
      _measure.trackBugReport(
        description,
        attachments,
        attributes,
      );
    }
  }

  @override
  Future<void> trackHandledError(Object error, StackTrace stack) {
    if (_isInitialized) {
      final details = FlutterErrorDetails(exception: error, stack: stack);
      return _measure.trackError(details, handled: true);
    }
    return Future.value();
  }

  @override
  void triggerNativeCrash() {
    if (_isInitialized) {
      _measure.triggerNativeCrash();
    }
  }

  bool _validateClientInfo(ClientInfo clientInfo) {
    if (clientInfo.apiKey.isEmpty) {
      developer.log("Failed to initialize Measure, apiKey is empty");
      return false;
    }

    if (!clientInfo.apiKey.startsWith("msrsh")) {
      developer.log("Failed to initialize Measure, apiKey is invalid");
      return false;
    }

    if (clientInfo.apiUrl.toString().isEmpty) {
      developer.log("Failed to initialize Measure, apiUrl is empty");
      return false;
    }
    return true;
  }

  void _logInitializationSuccess() {
    _measure.logger.log(
      LogLevel.debug,
      "Successfully initialized Measure Flutter SDK",
    );
  }

  void _logInitializationFailure(
    bool enableLogging,
    Object error,
    StackTrace stackTrace,
  ) {
    if (enableLogging) {
      developer.log(
        'Failed to initialize measure-flutter',
        name: 'Measure',
        error: error,
        stackTrace: stackTrace,
        level: 900,
      );
    }
  }

  void _logInputConfig(bool enableLogging, Map<String, dynamic> jsonConfig,
      Map<String, String> jsonClientInfo) {
    if (enableLogging) {
      developer.log(
        'Initializing measure-flutter with config: $jsonConfig',
        name: 'Measure',
        level: 100,
      );
      developer.log(
        'Initializing measure-flutter with client info: $jsonClientInfo',
        name: 'Measure',
        level: 100,
      );
    }
  }

  @override
  SpanBuilder? createSpanBuilder(String name) {
    if (isInitialized) {
      return _measure.createSpanBuilder(name);
    }
    return null;
  }

  @override
  String getTraceParentHeaderKey() {
    return _measure.getTraceParentHeaderKey();
  }

  @override
  String getTraceParentHeaderValue(Span span) {
    return _measure.getTraceParentHeaderValue(span);
  }

  @override
  Span startSpan(String name, {int? timestamp}) {
    if (isInitialized) {
      return _measure.createSpanBuilder(name).startSpan(timestamp: timestamp);
    } else {
      return Span.invalid();
    }
  }

  @override
  int getCurrentTime() {
    if (isInitialized) {
      return _measure.getCurrentTime();
    } else {
      return DateTime.now().millisecondsSinceEpoch;
    }
  }

  @override
  Future<void> clearUserId() async {
    if (isInitialized) {
      return _measure.clearUserId();
    }
    return Future.value(null);
  }

  @override
  Future<void> setUserId(String userId) {
    if (isInitialized) {
      return _measure.setUserId(userId);
    }
    return Future.value(null);
  }

  @override
  Future<String?> getSessionId() async {
    if (isInitialized) {
      return _measure.getSessionId();
    }
    return Future.value(null);
  }

  @override
  Future<MsrAttachment?> captureScreenshot() async {
    if (isInitialized) {
      return _measure.captureScreenshot();
    }
    return Future.value(null);
  }

  @override
  Widget createBugReportWidget({
    Key? key,
    BugReportTheme theme = const BugReportTheme(),
    Map<String, AttributeValue>? attributes = const {},
    MsrAttachment? screenshot,
  }) {
    if (isInitialized) {
      return _measure.createBugReport(
        screenshot: screenshot,
        theme: theme,
        attributes: attributes,
      );
    } else {
      developer
          .log('Failed to open bug report, Measure SDK is not initialized');
      return SizedBox.shrink(key: key);
    }
  }

  @override
  void setShakeListener(Function? onShake) {
    if (isInitialized) {
      _measure.setShakeListener(onShake);
    }
  }

  @override
  void trackClick(ClickData clickData) {
    if (isInitialized) {
      _measure.trackClick(clickData);
    }
  }

  @override
  void trackLongClick(LongClickData longClickData) {
    if (isInitialized) {
      _measure.trackLongClick(longClickData);
    }
  }

  @override
  void trackScroll(ScrollData scrollData) {
    if (isInitialized) {
      _measure.trackScroll(scrollData);
    }
  }

  /// Initialize both native SDK and internal Measure components
  Future<void> _initializeMeasureSDK(
    MeasureConfig config,
    ClientInfo clientInfo,
  ) async {
    final methodChannel = _methodChannel ?? MsrMethodChannel();
    await _initializeNativeSDK(config, clientInfo, methodChannel);
    await _initializeInternal(config, methodChannel);
  }

  /// Initialize the native SDK if auto-initialization is enabled
  Future<void> _initializeNativeSDK(
    MeasureConfig config,
    ClientInfo clientInfo,
    MsrMethodChannel methodChannel,
  ) async {
    if (config.autoInitializeNativeSDK) {
      var jsonConfig = config.toJson();
      var jsonClientInfo = clientInfo.toJson();
      _logInputConfig(config.enableLogging, jsonConfig, jsonClientInfo);
      return methodChannel.initializeNativeSDK(jsonConfig, jsonClientInfo);
    }
    return Future.value();
  }

  /// Initialize internal Measure components
  Future<void> _initializeInternal(
    MeasureConfig config,
    MsrMethodChannel methodChannel,
  ) async {
    final initializer = MeasureInitializer(config);
    _measure = MeasureInternal(
      initializer: initializer,
      methodChannel: methodChannel,
    );
    await _measure.init();
  }

  /// Setup global error handling for Flutter and platform errors
  Future<void> _setupErrorHandling() async {
    _initFlutterOnError();
    _initPlatformDispatcherOnError();
  }

  /// Setup Flutter error handler to track errors through Measure
  Future<void> _initFlutterOnError() async {
    final originalHandler = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) async {
      await _measure.trackError(details, handled: false);
      if (originalHandler != null) {
        originalHandler(details);
      }
    };
  }

  /// Setup platform dispatcher error handler and execute the main block
  Future<void> _initPlatformDispatcherOnError() async {
    PlatformDispatcher.instance.onError = (exception, stackTrace) {
      final details = FlutterErrorDetails(
        exception: exception,
        stack: stackTrace,
      );
      _measure.trackError(details, handled: false);
      return false;
    };
  }
}
