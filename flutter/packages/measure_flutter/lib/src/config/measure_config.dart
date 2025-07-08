import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/measure.dart';

import 'default_config.dart';

part 'measure_config.g.dart';

abstract class IMeasureConfig {
  bool get enableLogging;

  bool get takeScreenshotOnCrash;

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

  bool get trackActivityLoadTime;

  bool get trackFragmentLoadTime;

  bool get trackViewControllerLoadTime;
}

/// Configuration class for Measure SDK
@JsonSerializable()
class MeasureConfig implements IMeasureConfig {
  /// Enable or disable internal SDK logs. Defaults to `false`.
  @override
  final bool enableLogging;

  /// Whether to take a screenshot on crash. Defaults to `false`.
  @override
  final bool takeScreenshotOnCrash;

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

  /// Enable or disable automatic collection of Activity load time. Defaults to `true`
  /// for Android.
  ///
  /// Activity load time measures the time between the Activity being created and the first
  /// frame being drawn on the screen. This is also known as Time to First Frame (TTF) or
  /// Time to Initial Display (TTID). A large value for this metric would mean users are waiting
  /// for a long time before they see anything on the screen while navigating through the app.
  ///
  /// Each Activity load time is captured using a span with the name `Activity TTID` followed
  /// by the fully qualified class name of the Activity. For example, for
  /// `com.example.MainActivity` the span name would be `Activity TTID com.example.MainActivity`.
  @override
  final bool trackActivityLoadTime;

  /// Enable or disable automatic collection of Fragment load time. Defaults to `true`
  /// for Android.
  ///
  /// Fragment load time measures the time between the Fragment view being created and the
  /// first frame being drawn on the screen. This is also known as Time to First Frame (TTF)
  /// or Time to Initial Display (TTID). A large value for this metric would mean users are
  /// waiting for a long time before they see anything on the screen while navigating
  /// through the app.
  @override
  final bool trackFragmentLoadTime;

  /// Enables or disables automatic collection of ViewController load time. Defaults to `true`
  /// for iOS.
  ///
  /// ViewController load time measures the time between when the ViewController's view is loaded
  /// and the first frame is drawn on the screen. This is also known as **Time to First Frame (TTF)**
  /// or **Time to Initial Display (TTID)**.
  ///
  /// A large TTID value means users are waiting too long before any content appears on screen during
  /// app navigation.
  ///
  /// Each ViewController load time is captured as a `Span` with the name
  /// `VC TTID <class name>`. For example, for a class
  /// `MainViewController`, the span name would be:
  /// `VC TTID MainViewController`.
  ///
  /// Set to `false` to disable this tracking.
  @override
  final bool trackViewControllerLoadTime;

  /// Creates a new MeasureConfig instance
  const MeasureConfig({
    this.enableLogging = DefaultConfig.enableLogging,
    this.takeScreenshotOnCrash = DefaultConfig.takeScreenshotOnCrash,
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
    this.trackActivityLoadTime = DefaultConfig.trackActivityLoadTime,
    this.trackFragmentLoadTime = DefaultConfig.trackFragmentLoadTime,
    this.trackViewControllerLoadTime =
        DefaultConfig.trackViewControllerLoadTime,
  })  : assert(
            samplingRateForErrorFreeSessions >= 0.0 &&
                samplingRateForErrorFreeSessions <= 1.0,
            'session sampling rate must be between 0.0 and 1.0'),
        assert(traceSamplingRate >= 0.0 && traceSamplingRate <= 1.0,
            'Trace sampling rate must be between 0.0 and 1.0');

  /// Creates a new MeasureConfig instance from a JSON map
  factory MeasureConfig.fromJson(Map<String, dynamic> json) =>
      _$MeasureConfigFromJson(json);

  /// Creates a new MeasureConfig instance from a JSON map.
  Map<String, dynamic> toJson() => _$MeasureConfigToJson(this);
}
