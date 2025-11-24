import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/measure_flutter.dart';

import 'default_config.dart';

part 'measure_config.g.dart';

abstract class IMeasureConfig {
  bool get enableLogging;

  bool get trackScreenshotOnCrash;

  bool get autoInitializeNativeSDK;

  bool get autoStart;

  bool get trackHttpHeaders;

  bool get trackHttpBody;

  List<String> get httpHeadersBlocklist;

  List<String> get httpUrlBlocklist;

  List<String> get httpUrlAllowlist;

  bool get trackActivityIntentData;

  double get samplingRateForErrorFreeSessions;

  double get traceSamplingRate;

  int get maxDiskUsageInMb;

  double get coldLaunchSamplingRate;

  double get warmLaunchSamplingRate;

  double get hotLaunchSamplingRate;

  double get journeySamplingRate;
}

/// Configuration class for Measure SDK
@JsonSerializable()
class MeasureConfig implements IMeasureConfig {
  /// Enable or disable internal SDK logs. Defaults to `false`.
  @override
  final bool enableLogging;

  /// Whether to take a screenshot on crash. Defaults to `false`.
  @override
  final bool trackScreenshotOnCrash;

  /// Whether to automatically initialize the native SDK. Defaults to `true`.
  /// The native SDK must be initialized manually if set to `false`.
  @override
  final bool autoInitializeNativeSDK;

  /// Control when the SDK starts collecting events. Defaults to `true`.
  ///
  /// By default, initializing the SDK also starts collecting events. Set this
  /// to false to manually control when to collect events.
  ///
  /// Call [Measure.start] to manually start collecting events.
  /// Call [Measure.stop] to stop collecting events.
  @override
  final bool autoStart;

  /// Whether to capture http headers of a network request and response. Defaults to `false`.
  @override
  final bool trackHttpHeaders;

  /// Whether to capture http body of a network request and response. Defaults to `false`.
  @override
  final bool trackHttpBody;

  /// List of HTTP headers to not collect with the `http` event for both request and response.
  /// Defaults to an empty list. The following headers are always excluded:
  /// * Authorization
  /// * Cookie
  /// * Set-Cookie
  /// * Proxy-Authorization
  /// * WWW-Authenticate
  /// * X-Api-Key
  @override
  final List<String> httpHeadersBlocklist;

  /// Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not
  /// want to collect data for certain endpoints.
  ///
  /// The check is made using [String.contains] to see if the URL contains any of the strings in
  /// the list.
  ///
  /// Note that this config is ignored if [httpUrlAllowlist] is set.
  ///
  /// Example:
  ///
  /// ```dart
  /// MeasureConfig(
  ///     httpUrlBlocklist: [
  ///         "example.com", // disables a domain
  ///         "api.example.com", // disable a subdomain
  ///         "example.com/order" // disable a particular path
  ///     ]
  /// )
  /// ```
  @override
  final List<String> httpUrlBlocklist;

  /// Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not
  /// want to collect data for all endpoints except for a few.
  ///
  /// The check is made using [String.contains] to see if the URL contains any of the strings in
  /// the list.
  ///
  /// Example:
  ///
  /// ```dart
  /// MeasureConfig(
  ///    httpUrlAllowlist: [
  ///      "example.com", // enables a domain
  ///      "api.example.com", // enable a subdomain
  ///      "example.com/order" // enable a particular path
  ///    ]
  /// )
  /// ```
  @override
  final List<String> httpUrlAllowlist;

  /// Whether to capture intent data used to launch an Activity. Defaults to `false`.
  @override
  final bool trackActivityIntentData;

  /// Sampling rate for sessions without a crash or ANR.
  ///
  /// The sampling rate is a value between 0 and 1. For example, a value of `0.5` will export
  /// only 50% of the non-crashed sessions, a value of `0` will disable send non-crashed
  /// sessions to the server.
  ///
  /// Setting a value outside the range will throw an [ArgumentError].
  @override
  final double samplingRateForErrorFreeSessions;

  /// Allows setting a sampling rate for traces. Defaults to 0.1.
  ///
  /// The sampling rate is a value between 0 and 1. For example, a value of `0.1` will export
  /// only 10% of all traces, a value of `0` will disable exporting of traces.
  ///
  /// Setting a value outside the range will throw an [ArgumentError].
  @override
  final double traceSamplingRate;

  /// Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use.
  ///
  /// This is useful to control the amount of disk space used by the SDK for storing session data,
  /// crash reports, and other collected information.
  ///
  /// Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`. Any value outside this
  /// range will be clamped to the nearest limit.
  /// All Measure SDKs store data to disk and upload it to the server in batches. While the app is
  /// in foreground, the data is synced periodically and usually the disk space used by the SDK is
  /// low. However, if the device is offline or the server is unreachable, the SDK will continue to
  /// store data on disk until it reaches the maximum disk usage limit.
  ///
  /// Note that the storage usage is not exact and works on estimates and typically the SDK will
  /// use much less disk space than the configured limit.
  ///
  /// When the SDK reaches the maximum disk usage limit, it will start deleting the oldest data
  /// to make space for new data.
  @override
  final int maxDiskUsageInMb;

  /// Configure sampling rate for cold launch events. Defaults to 0.01, ie, 1%.
  ///
  /// A cold launch refers to an app starting from scratch. Cold launch happens in cases such
  /// as an app launching for the first time since the device booted or since the system
  /// killed the app.
  @override
  final double coldLaunchSamplingRate;

  /// Configure sampling rate for warm launch events. Defaults to 0.01, ie, 1%.
  ///
  /// A warm launch refers to the re-launch of an app causing an Activity onCreate to be
  /// triggered instead of just onResume. This requires the system to recreate the activity from
  /// scratch and hence requires more work than a hot launch.
  @override
  final double warmLaunchSamplingRate;

  /// Configure sampling rate for hot launch events. Defaults to 0.01, ie, 1%.
  ///
  /// A hot launch refers to the re-launch of an app causing an Activity onResume to be triggered.
  /// This typically requires less work than a warm launch as the system does not need to recreate
  /// the activity from scratch.
  @override
  final double hotLaunchSamplingRate;

  /// Configures sampling rate for sessions that track "user journeys". This feature shows
  /// traffic of users across different screens of the app. When set to 0, the journey will only
  /// be generated from crashed sessions or sessions collected using
  /// [samplingRateForErrorFreeSessions].
  ///
  /// Defaults to 0.
  ///
  /// If a value of 0.1 is set, then 10% of the sessions will contain events required
  /// to build the journey which includes screen view, lifecycle activity and lifecycle fragments.
  ///
  /// **Note: a higher value for this config can significantly increase the number of events
  /// collected for your app.**
  @override
  final double journeySamplingRate;

  /// Creates a new MeasureConfig instance
  const MeasureConfig({
    this.enableLogging = DefaultConfig.enableLogging,
    this.trackScreenshotOnCrash = DefaultConfig.trackScreenshotOnCrash,
    this.autoInitializeNativeSDK = DefaultConfig.autoInitializeNativeSDK,
    this.autoStart = DefaultConfig.autoStart,
    this.trackHttpHeaders = DefaultConfig.trackHttpHeaders,
    this.trackHttpBody = DefaultConfig.trackHttpBody,
    this.httpHeadersBlocklist = DefaultConfig.httpHeadersBlocklist,
    this.httpUrlBlocklist = DefaultConfig.httpUrlBlocklist,
    this.httpUrlAllowlist = DefaultConfig.httpUrlAllowlist,
    this.trackActivityIntentData = DefaultConfig.trackActivityIntentData,
    this.samplingRateForErrorFreeSessions = DefaultConfig.sessionSamplingRate,
    this.traceSamplingRate = DefaultConfig.traceSamplingRate,
    this.maxDiskUsageInMb = DefaultConfig.maxDiskUsageInMb,
    this.coldLaunchSamplingRate = DefaultConfig.coldLaunchSamplingRate,
    this.warmLaunchSamplingRate = DefaultConfig.warmLaunchSamplingRate,
    this.hotLaunchSamplingRate = DefaultConfig.hotLaunchSamplingRate,
    this.journeySamplingRate = DefaultConfig.journeySamplingRate,
  })  : assert(samplingRateForErrorFreeSessions >= 0.0 && samplingRateForErrorFreeSessions <= 1.0,
            'session sampling rate must be between 0.0 and 1.0'),
        assert(traceSamplingRate >= 0.0 && traceSamplingRate <= 1.0, 'Trace sampling rate must be between 0.0 and 1.0'),
        assert(maxDiskUsageInMb >= 20 && maxDiskUsageInMb <= 1500, 'maxDiskUsageInMb must be between 20 - 1500');

  /// Creates a new MeasureConfig instance from a JSON map
  factory MeasureConfig.fromJson(Map<String, dynamic> json) => _$MeasureConfigFromJson(json);

  /// Creates a new MeasureConfig instance from a JSON map.
  Map<String, dynamic> toJson() => _$MeasureConfigToJson(this);
}
