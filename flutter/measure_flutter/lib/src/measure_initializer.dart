import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/signal_processor.dart';

import 'config/measure_config.dart';
import 'logger/flutter_logger.dart';
import 'logger/logger.dart';

final class MeasureInitializer {
  final MeasureConfig config;
  late final Logger _logger;
  late final CustomEventCollector _customEventCollector;
  late final SignalProcessor _signalProcessor;

  Logger get logger => _logger;

  CustomEventCollector get customEventCollector => _customEventCollector;

  SignalProcessor get signalProcessor => _signalProcessor;

  MeasureInitializer(this.config) {
    _initializeDependencies();
  }

  void _initializeDependencies() {
    _logger = FlutterLogger(enabled: config.enableLogging);
    _signalProcessor = SignalProcessor(logger: logger);
    _customEventCollector = CustomEventCollector(
      logger: logger,
      signalProcessor: signalProcessor,
    );
  }

  @visibleForTesting
  MeasureInitializer.withOverrides(
    this.config, {
    Logger? logger,
    CustomEventCollector? customEventCollector,
  }) {
    _logger = logger ?? FlutterLogger(enabled: config.enableLogging);
    _signalProcessor = SignalProcessor(logger: _logger);
    _customEventCollector = customEventCollector ??
        CustomEventCollector(
          logger: _logger,
          signalProcessor: signalProcessor,
        );
  }
}
