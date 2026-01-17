import 'package:flutter/cupertino.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';

part 'dynamic_config.g.dart';

/// Interface exposing dynamic configuration values for the SDK.
abstract interface class IDynamicConfig {
  /// Sampling rate for traces. Defaults to 0.01%, which means one in 10000 traces will be sampled.
  double get traceSamplingRate;

  /// The screenshot mask level to be applied to screenshots. Defaults
  /// to [ScreenshotMaskLevel.allTextAndMedia].
  ScreenshotMaskLevel get screenshotMaskLevel;

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
    required this.crashTakeScreenshot,
    required this.gestureClickTakeSnapshot,
    required this.httpDisableEventForUrls,
    required this.httpTrackRequestForUrls,
    required this.httpTrackResponseForUrls,
    required this.httpBlockedHeaders,
  });

  /// Creates a [DynamicConfig] with default values.
  factory DynamicConfig.defaults() => const DynamicConfig(
    traceSamplingRate: 0.01,
    screenshotMaskLevel: ScreenshotMaskLevel.allTextAndMedia,
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