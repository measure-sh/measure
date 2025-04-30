import 'dart:developer' as developer;

import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/config/measure_config.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/measure_interface.dart';
import 'package:measure_flutter/src/measure_internal.dart';

class Measure implements IMeasure {
  Measure._();

  static final Measure instance = Measure._();

  late MeasureInternal _measure;
  bool _isInitialized = false;

  @visibleForTesting
  bool get isInitialized => _isInitialized;

  @override
  Future<void> init({
    bool enableLogging = false,
  }) async {
    if (_isInitialized) {
      return;
    }

    try {
      await _initializeInternal(enableLogging);
      _isInitialized = true;
      _logInitializationSuccess();
    } catch (e, stackTrace) {
      _logInitializationFailure(enableLogging, e, stackTrace);
    }
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
  Future<void> trackFlutterError(FlutterErrorDetails details) {
    if (_isInitialized) {
      return _measure.trackFlutterError(details);
    }
    return Future.value();
  }

  @override
  void triggerNativeCrash() {
    if (_isInitialized) {
      _measure.triggerNativeCrash();
    }
  }

  Future<void> _initializeInternal(bool enableLogging) async {
    MeasureInitializer initializer =
        MeasureInitializer(MeasureConfig(enableLogging: enableLogging));
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
