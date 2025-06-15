import 'default_config.dart';
import 'internal_config.dart';
import 'measure_config.dart';

class Config implements InternalConfig, IMeasureConfig {
  const Config({
    this.enableLogging = DefaultConfig.enableLogging,
    this.autoInitializeNativeSDK = DefaultConfig.autoInitializeNativeSDK,
    this.trackHttpHeaders = DefaultConfig.trackHttpHeaders,
    this.trackHttpBody = DefaultConfig.trackHttpBody,
    this.httpHeadersBlocklist = DefaultConfig.httpHeadersBlocklist,
    this.httpUrlBlocklist = DefaultConfig.httpUrlBlocklist,
    this.httpUrlAllowlist = DefaultConfig.httpUrlAllowlist,
    this.trackActivityIntentData = DefaultConfig.trackActivityIntentData,
    this.samplingRateForErrorFreeSessions = DefaultConfig.sessionSamplingRate,
    this.traceSamplingRate = DefaultConfig.traceSamplingRate,
    this.trackActivityLoadTime = DefaultConfig.trackActivityLoadTime,
    this.trackFragmentLoadTime = DefaultConfig.trackFragmentLoadTime,
    this.trackViewControllerLoadTime =
        DefaultConfig.trackViewControllerLoadTime,
    this.maxCheckpointsPerSpan = DefaultConfig.maxCheckpointsPerSpan,
    this.maxSpanNameLength = DefaultConfig.maxSpanNameLength,
    this.maxCheckpointNameLength = DefaultConfig.maxCheckpointNameLength,
  });

  @override
  final bool enableLogging;
  @override
  final bool autoInitializeNativeSDK;
  @override
  final bool trackHttpHeaders;
  @override
  final bool trackHttpBody;
  @override
  final List<String> httpHeadersBlocklist;
  @override
  final List<String> httpUrlBlocklist;
  @override
  final List<String> httpUrlAllowlist;
  @override
  final bool trackActivityIntentData;
  @override
  final double samplingRateForErrorFreeSessions;
  @override
  final double traceSamplingRate;
  @override
  final bool trackActivityLoadTime;
  @override
  final bool trackFragmentLoadTime;
  @override
  final bool trackViewControllerLoadTime;
  @override
  final int maxCheckpointNameLength;
  @override
  final int maxCheckpointsPerSpan;
  @override
  final int maxSpanNameLength;

  @override
  List<String> get defaultHttpContentTypeAllowlist =>
      const ["application/json"];

  @override
  List<String> get defaultHttpHeadersBlocklist => const [
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
      ];

  Config copyWith({
    bool? enableLogging,
    bool? autoInitializeNativeSDK,
    bool? trackHttpHeaders,
    bool? trackHttpBody,
    List<String>? httpHeadersBlocklist,
    List<String>? httpUrlBlocklist,
    List<String>? httpUrlAllowlist,
    bool? trackActivityIntentData,
    double? samplingRateForErrorFreeSessions,
    double? traceSamplingRate,
    bool? trackActivityLoadTime,
    bool? trackFragmentLoadTime,
    bool? trackViewControllerLoadTime,
    int? maxCheckpointsPerSpan,
    int? maxSpanNameLength,
    int? maxCheckpointNameLength,
  }) {
    return Config(
      enableLogging: enableLogging ?? this.enableLogging,
      autoInitializeNativeSDK:
          autoInitializeNativeSDK ?? this.autoInitializeNativeSDK,
      trackHttpHeaders: trackHttpHeaders ?? this.trackHttpHeaders,
      trackHttpBody: trackHttpBody ?? this.trackHttpBody,
      httpHeadersBlocklist: httpHeadersBlocklist ?? this.httpHeadersBlocklist,
      httpUrlAllowlist: httpUrlAllowlist ?? this.httpUrlAllowlist,
      httpUrlBlocklist: httpUrlBlocklist ?? this.httpUrlBlocklist,
      trackActivityIntentData:
          trackActivityIntentData ?? this.trackActivityIntentData,
      samplingRateForErrorFreeSessions: samplingRateForErrorFreeSessions ??
          this.samplingRateForErrorFreeSessions,
      traceSamplingRate: traceSamplingRate ?? this.traceSamplingRate,
      trackActivityLoadTime:
          trackActivityLoadTime ?? this.trackActivityLoadTime,
      trackFragmentLoadTime:
          trackFragmentLoadTime ?? this.trackFragmentLoadTime,
      trackViewControllerLoadTime:
          trackViewControllerLoadTime ?? this.trackViewControllerLoadTime,
      maxCheckpointsPerSpan:
          maxCheckpointsPerSpan ?? this.maxCheckpointsPerSpan,
      maxSpanNameLength: maxSpanNameLength ?? this.maxSpanNameLength,
      maxCheckpointNameLength:
          maxCheckpointNameLength ?? this.maxCheckpointNameLength,
    );
  }
}
