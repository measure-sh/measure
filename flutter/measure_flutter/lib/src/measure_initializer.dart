import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/src/config/measure_config.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/exception/exception_collector.dart';
import 'package:measure_flutter/src/logger/flutter_logger.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';

final class MeasureInitializer {
  final MeasureConfig config;
  late final Logger _logger;
  late final MsrMethodChannel _methodChannel;
  late final CustomEventCollector _customEventCollector;
  late final ExceptionCollector _exceptionCollector;
  late final NavigationCollector _navigationCollector;
  late final SignalProcessor _signalProcessor;

  Logger get logger => _logger;

  MsrMethodChannel get methodChannel => _methodChannel;

  CustomEventCollector get customEventCollector => _customEventCollector;

  ExceptionCollector get exceptionCollector => _exceptionCollector;

  NavigationCollector get navigationCollector => _navigationCollector;

  SignalProcessor get signalProcessor => _signalProcessor;

  MeasureInitializer(this.config) {
    _initializeDependencies();
  }

  void _initializeDependencies() {
    _logger = FlutterLogger(enabled: config.enableLogging);
    _methodChannel = MsrMethodChannel();
    _signalProcessor =
        DefaultSignalProcessor(logger: logger, channel: _methodChannel);
    _customEventCollector = CustomEventCollector(
      logger: logger,
      signalProcessor: signalProcessor,
    );
    _exceptionCollector = ExceptionCollector(
      logger: logger,
      signalProcessor: signalProcessor,
    );
    _navigationCollector =
        NavigationCollector(signalProcessor: signalProcessor);
  }

  @visibleForTesting
  MeasureInitializer.withOverrides(
    this.config, {
    Logger? logger,
    CustomEventCollector? customEventCollector,
  }) {
    _logger = logger ?? FlutterLogger(enabled: config.enableLogging);
    _methodChannel = MsrMethodChannel();
    _signalProcessor =
        DefaultSignalProcessor(logger: _logger, channel: _methodChannel);
    _customEventCollector = customEventCollector ??
        CustomEventCollector(
          logger: _logger,
          signalProcessor: signalProcessor,
        );
    _exceptionCollector = ExceptionCollector(
      logger: _logger,
      signalProcessor: signalProcessor,
    );
    _navigationCollector =
        NavigationCollector(signalProcessor: signalProcessor);
  }
}
