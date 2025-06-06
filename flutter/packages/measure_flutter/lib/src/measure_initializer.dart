import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/src/config/config.dart';
import 'package:measure_flutter/src/config/measure_config.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/exception/exception_collector.dart';
import 'package:measure_flutter/src/http/http_collector.dart';
import 'package:measure_flutter/src/logger/flutter_logger.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';

import 'config/config_provider.dart';

final class MeasureInitializer {
  late final Logger _logger;
  late final ConfigProvider _configProvider;
  late final MsrMethodChannel _methodChannel;
  late final CustomEventCollector _customEventCollector;
  late final ExceptionCollector _exceptionCollector;
  late final NavigationCollector _navigationCollector;
  late final HttpCollector _httpCollector;
  late final SignalProcessor _signalProcessor;

  Logger get logger => _logger;

  ConfigProvider get configProvider => _configProvider;

  MsrMethodChannel get methodChannel => _methodChannel;

  CustomEventCollector get customEventCollector => _customEventCollector;

  ExceptionCollector get exceptionCollector => _exceptionCollector;

  NavigationCollector get navigationCollector => _navigationCollector;

  HttpCollector get httpCollector => _httpCollector;

  SignalProcessor get signalProcessor => _signalProcessor;

  MeasureInitializer(MeasureConfig inputConfig) {
    _initializeDependencies(inputConfig);
  }

  void _initializeDependencies(MeasureConfig inputConfig) {
    _logger = FlutterLogger(enabled: inputConfig.enableLogging);
    _configProvider = ConfigProviderImpl(
      defaultConfig: Config(
        enableLogging: inputConfig.enableLogging,
        trackHttpHeaders: inputConfig.trackHttpHeaders,
        trackHttpBody: inputConfig.trackHttpBody,
        httpHeadersBlocklist: inputConfig.httpHeadersBlocklist,
        httpUrlBlocklist: inputConfig.httpUrlBlocklist,
        httpUrlAllowlist: inputConfig.httpUrlAllowlist,
      ),
    );
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
    _httpCollector = HttpCollector(signalProcessor: signalProcessor);
  }

  @visibleForTesting
  MeasureInitializer.withOverrides({
    Logger? logger,
    MeasureConfig config = const MeasureConfig(),
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
    _httpCollector = HttpCollector(signalProcessor: signalProcessor);
  }
}
