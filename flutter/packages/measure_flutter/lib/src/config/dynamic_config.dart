import 'package:flutter/cupertino.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';

part 'dynamic_config.g.dart';

/// Interface exposing dynamic configuration values for the SDK.
abstract interface class IDynamicConfig {
  /// Sampling rate for traces. Defaults to 100%, which means all traces will be sampled.
  double get traceSamplingRate;

  /// The screenshot mask level to be applied to screenshots. Defaults
  /// to [ScreenshotMaskLevel.allTextAndMedia].
  ScreenshotMaskLevel get screenshotMaskLevel;

  /// Minimum severity number of logs to collect. Logs below this number are
  /// dropped. Defaults to 16 (warning).
  int get logMinSeverity;

  /// Regex patterns matched against the log body. A log whose body matches any
  /// of the patterns is dropped. Defaults to empty list.
  List<String> get logIgnorePatterns;

  /// Whether to take a screenshot when a crash occurs. Defaults to true.
  bool get crashTakeScreenshot;

  /// Whether to take a layout snapshot when a gesture click occurs. Defaults to true.
  bool get gestureClickTakeSnapshot;

  /// List of URLs to disable sending events for. Defaults to empty list.
  /// The URLs can use wildcard patterns.
  List<String> get httpDisableEventForUrls;

  /// List of URLs to track requests for. Defaults to empty list.
  /// The URLs can use wildcard patterns.
  List<String> get httpTrackRequestForUrls;

  /// List of URLs to track responses for. Defaults to empty list.
  /// The URLs can use wildcard patterns.
  List<String> get httpTrackResponseForUrls;

  /// List of HTTP headers to not collect with the `http` event for both request and response.
  ///
  /// The following headers are always excluded:
  /// * Authorization
  /// * Cookie
  /// * Set-Cookie
  /// * Proxy-Authorization
  /// * WWW-Authenticate
  /// * X-Api-Key
  List<String> get httpBlockedHeaders;
}

@JsonSerializable()
class DynamicConfig implements IDynamicConfig {
  @override
  @JsonKey(name: 'trace_sampling_rate')
  final double traceSamplingRate;

  @override
  @JsonKey(name: 'screenshot_mask_level')
  final ScreenshotMaskLevel screenshotMaskLevel;

  @override
  @JsonKey(name: 'log_min_severity', defaultValue: 16)
  final int logMinSeverity;

  @override
  @JsonKey(name: 'log_ignore_patterns', defaultValue: [])
  final List<String> logIgnorePatterns;

  @override
  @JsonKey(name: 'crash_take_screenshot')
  final bool crashTakeScreenshot;

  @override
  @JsonKey(name: 'gesture_click_take_snapshot')
  final bool gestureClickTakeSnapshot;

  @override
  @JsonKey(name: 'http_disable_event_for_urls')
  final List<String> httpDisableEventForUrls;

  @override
  @JsonKey(name: 'http_track_request_for_urls')
  final List<String> httpTrackRequestForUrls;

  @override
  @JsonKey(name: 'http_track_response_for_urls')
  final List<String> httpTrackResponseForUrls;

  @override
  @JsonKey(name: 'http_blocked_headers')
  final List<String> httpBlockedHeaders;

  const DynamicConfig({
    required this.traceSamplingRate,
    required this.screenshotMaskLevel,
    required this.logMinSeverity,
    required this.logIgnorePatterns,
    required this.crashTakeScreenshot,
    required this.gestureClickTakeSnapshot,
    required this.httpDisableEventForUrls,
    required this.httpTrackRequestForUrls,
    required this.httpTrackResponseForUrls,
    required this.httpBlockedHeaders,
  });

  /// Creates a [DynamicConfig] with default values.
  factory DynamicConfig.defaults() => const DynamicConfig(
    traceSamplingRate: 100,
    screenshotMaskLevel: ScreenshotMaskLevel.allTextAndMedia,
    logMinSeverity: 16,
    logIgnorePatterns: [],
    crashTakeScreenshot: true,
    gestureClickTakeSnapshot: true,
    httpDisableEventForUrls: [],
    httpTrackRequestForUrls: [],
    httpTrackResponseForUrls: [],
    httpBlockedHeaders: [
      'Authorization',
      'Cookie',
      'Set-Cookie',
      'Proxy-Authorization',
      'WWW-Authenticate',
      'X-Api-Key',
    ],
  );

  @visibleForTesting
  DynamicConfig copyWith({
    double? traceSamplingRate,
    ScreenshotMaskLevel? screenshotMaskLevel,
    int? logMinSeverity,
    List<String>? logIgnorePatterns,
    bool? crashTakeScreenshot,
    bool? gestureClickTakeSnapshot,
    List<String>? httpDisableEventForUrls,
    List<String>? httpTrackRequestForUrls,
    List<String>? httpTrackResponseForUrls,
    List<String>? httpBlockedHeaders,
  }) {
    return DynamicConfig(
      traceSamplingRate: traceSamplingRate ?? this.traceSamplingRate,
      screenshotMaskLevel: screenshotMaskLevel ?? this.screenshotMaskLevel,
      logMinSeverity: logMinSeverity ?? this.logMinSeverity,
      logIgnorePatterns: logIgnorePatterns ?? this.logIgnorePatterns,
      crashTakeScreenshot: crashTakeScreenshot ?? this.crashTakeScreenshot,
      gestureClickTakeSnapshot: gestureClickTakeSnapshot ?? this.gestureClickTakeSnapshot,
      httpDisableEventForUrls: httpDisableEventForUrls ?? this.httpDisableEventForUrls,
      httpTrackRequestForUrls: httpTrackRequestForUrls ?? this.httpTrackRequestForUrls,
      httpTrackResponseForUrls: httpTrackResponseForUrls ?? this.httpTrackResponseForUrls,
      httpBlockedHeaders: httpBlockedHeaders ?? this.httpBlockedHeaders,
    );
  }

  factory DynamicConfig.fromJson(Map<String, dynamic> json) =>
      _$DynamicConfigFromJson(json);

  Map<String, dynamic> toJson() => _$DynamicConfigToJson(this);
}