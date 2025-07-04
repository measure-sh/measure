import 'package:measure_flutter/src/bug_report/bug_report_collector.dart';
import 'package:measure_flutter/src/bug_report/shake_detector.dart';
import 'package:measure_flutter/src/config/config.dart';
import 'package:measure_flutter/src/config/measure_config.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/exception/exception_collector.dart';
import 'package:measure_flutter/src/http/http_collector.dart';
import 'package:measure_flutter/src/logger/flutter_logger.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/method_channel_callbacks.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';
import 'package:measure_flutter/src/storage/file_storage.dart';
import 'package:measure_flutter/src/time/date_time_clock.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/tracing/randomizer.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';
import 'package:measure_flutter/src/tracing/trace_sampler.dart';
import 'package:measure_flutter/src/tracing/tracer.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import 'config/config_provider.dart';

final class MeasureInitializer {
  late final Logger _logger;
  late final IdProvider _idProvider;
  late final TimeProvider _timeProvider;
  late final ConfigProvider _configProvider;
  late final MsrMethodChannel _methodChannel;
  late final MethodChannelCallbacks _methodChannelCallbacks;
  late final CustomEventCollector _customEventCollector;
  late final ExceptionCollector _exceptionCollector;
  late final NavigationCollector _navigationCollector;
  late final BugReportCollector _bugReportCollector;
  late final HttpCollector _httpCollector;
  late final SignalProcessor _signalProcessor;
  late final SpanProcessor _spanProcessor;
  late final Tracer _tracer;
  late final FileStorage _fileStorage;
  late final ShakeDetector _shakeDetector;

  Logger get logger => _logger;

  ConfigProvider get configProvider => _configProvider;

  MsrMethodChannel get methodChannel => _methodChannel;

  MethodChannelCallbacks get methodChannelCallbacks => _methodChannelCallbacks;

  CustomEventCollector get customEventCollector => _customEventCollector;

  ExceptionCollector get exceptionCollector => _exceptionCollector;

  NavigationCollector get navigationCollector => _navigationCollector;

  BugReportCollector get bugReportCollector => _bugReportCollector;

  HttpCollector get httpCollector => _httpCollector;

  SignalProcessor get signalProcessor => _signalProcessor;

  IdProvider get idProvider => _idProvider;

  TimeProvider get timeProvider => _timeProvider;

  SpanProcessor get spanProcessor => _spanProcessor;

  Tracer get tracer => _tracer;

  FileStorage get storage => _fileStorage;

  ShakeDetector get shakeDetector => _shakeDetector;

  MeasureInitializer(MeasureConfig inputConfig) {
    _initializeDependencies(inputConfig);
  }

  void _initializeDependencies(MeasureConfig inputConfig) {
    _logger = FlutterLogger(enabled: inputConfig.enableLogging);
    final clock = DateTimeClock();
    _timeProvider = FlutterTimeProvider(clock);
    _configProvider = ConfigProviderImpl(
      defaultConfig: Config(
        enableLogging: inputConfig.enableLogging,
        trackHttpHeaders: inputConfig.trackHttpHeaders,
        trackHttpBody: inputConfig.trackHttpBody,
        httpHeadersBlocklist: inputConfig.httpHeadersBlocklist,
        httpUrlBlocklist: inputConfig.httpUrlBlocklist,
        httpUrlAllowlist: inputConfig.httpUrlAllowlist,
        autoInitializeNativeSDK: inputConfig.autoInitializeNativeSDK,
        trackActivityIntentData: inputConfig.trackActivityIntentData,
        samplingRateForErrorFreeSessions:
            inputConfig.samplingRateForErrorFreeSessions,
        traceSamplingRate: inputConfig.traceSamplingRate,
        trackActivityLoadTime: inputConfig.trackActivityLoadTime,
        trackFragmentLoadTime: inputConfig.trackFragmentLoadTime,
        trackViewControllerLoadTime: inputConfig.trackViewControllerLoadTime,
        autoStart: inputConfig.autoStart,
      ),
    );
    _methodChannel = MsrMethodChannel();
    _methodChannelCallbacks = MethodChannelCallbacks(_methodChannel, _logger);
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
    final randomizer = RandomizerImpl();
    _fileStorage = FileStorage(methodChannel, logger);
    _idProvider = IdProviderImpl(randomizer);
    _shakeDetector = ShakeDetectorImpl(
      methodChannel: _methodChannel,
      methodChannelCallbacks: methodChannelCallbacks,
    );
    _bugReportCollector = BugReportCollector(
      logger: logger,
      configProvider: configProvider,
      signalProcessor: signalProcessor,
      fileStorage: _fileStorage,
      idProvider: _idProvider,
      shakeDetector: _shakeDetector
    );
    _spanProcessor = MsrSpanProcessor(
      _logger,
      _signalProcessor,
      _configProvider,
    );
    _tracer = MsrTracer(
      logger: logger,
      idProvider: _idProvider,
      timeProvider: _timeProvider,
      spanProcessor: _spanProcessor,
      traceSampler: TraceSamplerImpl(randomizer, _configProvider),
    );
  }
}
