import 'dart:async';
import 'dart:developer' as developer;
import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/measure_internal.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

import 'measure.dart';

export 'src/config/client.dart';
export 'src/config/measure_config.dart';
export 'src/measure_api.dart';
export 'src/navigation/navigator_observer.dart';
export 'src/tracing/checkpoint.dart';
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
  Future<void> start(
    FutureOr<void> Function() action, {
    required ClientInfo clientInfo,
    MeasureConfig config = const MeasureConfig(),
  }) async {
    final startTime = DateTime.now();
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
    final result = action();
    Measure.instance
        .startSpan("msr-init", timestamp: startTime.millisecondsSinceEpoch)
        .end();
    return result;
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
      if (originalHandler != null) {
        await _measure.trackError(details, handled: false);
        originalHandler(details);
      } else {
        FlutterError.presentError(details);
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
    DateTime? timestamp,
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
  Future<void> trackHandledError(Object error, StackTrace stack) {
    if (_isInitialized) {
      final details = FlutterErrorDetails(exception: error, stack: stack);
      return _measure.trackError(details, handled: false);
    }
    return Future.value();
  }

  @override
  void triggerNativeCrash() {
    if (_isInitialized) {
      _measure.triggerNativeCrash();
    }
  }

  /// Starts a new performance tracing span with the specified [name].
  ///
  /// [name] The name to identify this span.
  /// [timestamp] An optional timestamp in milliseconds since the Unix epoch.
  ///
  /// Returns [Span] A new span instance if the SDK is initialized, or an invalid no-op span if not initialized
  @override
  Span startSpan(
    String name, {
    int? timestamp,
  }) {
    if (_isInitialized) {
      return _measure.startSpan(name, timestamp: timestamp);
    } else {
      return Span.invalid();
    }
  }

  /// Creates a configurable span builder for deferred span creation.
  ///
  /// [name] The name to identify this span.
  ///
  /// Returns [SpanBuilder?] A builder instance to configure the span if the SDK is initialized,
  /// or null if the SDK is not initialized
  ///
  /// Note: Use this method when you need to create a span without immediately starting it.
  @override
  SpanBuilder? createSpanBuilder(String name) {
    if (_isInitialized) {
      return _measure.createSpan(name);
    } else {
      return null;
    }
  }

  /// Returns the W3C traceparent header value for the given span.
  ///
  /// [span] The span to extract the traceparent header value from
  /// Returns A W3C trace context compliant header value in the format:
  /// `{version}-{traceId}-{spanId}-{traceFlags}`
  ///
  /// Example: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
  ///
  /// See also:
  /// * [getTraceParentHeaderKey]
  /// * [W3C Trace Context specification](https://www.w3.org/TR/trace-context/#header-name)
  ///
  /// Note: Use this value in the `traceparent` HTTP header when making API calls to enable
  /// distributed tracing between your mobile app and backend services.
  @override
  String getTraceParentHeaderValue(Span span) {
    return _measure.getTraceParentHeaderValue(span);
  }

  /// Returns the W3C traceparent header key/name.
  ///
  /// Returns The standardized header key 'traceparent' that should be used when adding
  /// distributed tracing context to HTTP requests
  ///
  /// See also:
  /// * [getTraceParentHeaderValue]
  /// * [W3C Trace Context specification](https://www.w3.org/TR/trace-context/#header-name)
  @override
  String getTraceParentHeaderKey() {
    return _measure.getTraceParentHeaderKey();
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
}
