import 'dart:async';
import 'dart:developer' as developer;
import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/measure_internal.dart';

import 'measure.dart';

export 'src/config/measure_config.dart';
export 'src/measure_api.dart';
export 'src/navigation/navigator_observer.dart';

class Measure implements MeasureApi {
  Measure._();

  static final Measure instance = Measure._();

  late MeasureInternal _measure;
  bool _isInitialized = false;

  @visibleForTesting
  bool get isInitialized => _isInitialized;

  @override
  Future<void> start(
    FutureOr<void> Function() block, {
    MeasureConfig config = const MeasureConfig(),
  }) async {
    WidgetsFlutterBinding.ensureInitialized();
    try {
      await _initializeInternal(config);
      _isInitialized = true;
      _logInitializationSuccess();
    } catch (e, stackTrace) {
      _logInitializationFailure(config.enableLogging, e, stackTrace);
    }
    await _initFlutterOnError();
    await _initPlatformDispatcherOnError(block);
  }

  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpBody(url, contentType);
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
  bool shouldTrackHttpUrl(String url) {
    if (isInitialized) {
      return _measure.configProvider.shouldTrackHttpUrl(url);
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

  @override
  void trackScreenViewEvent({required String name, bool userTriggered = true}) {
    if (_isInitialized) {
      _measure.trackScreenViewEvent(name: name, userTriggered: userTriggered);
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

  Future<void> _initPlatformDispatcherOnError(
    FutureOr<void> Function() block,
  ) async {
    PlatformDispatcher.instance.onError = (exception, stackTrace) {
      final details =
          FlutterErrorDetails(exception: exception, stack: stackTrace);
      _measure.trackError(details, handled: false);
      return false;
    };
    await block();
  }

  Future<void> _initializeInternal(MeasureConfig config) async {
    MeasureInitializer initializer = MeasureInitializer(config);
    _measure = MeasureInternal(initializer: initializer);
    await _measure.init();
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

  void _logInitializationSuccess() {
    _measure.logger
        .log(LogLevel.debug, "Successfully initialized Measure Flutter SDK");
  }
}
