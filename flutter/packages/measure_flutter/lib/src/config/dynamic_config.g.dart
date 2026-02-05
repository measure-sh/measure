// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dynamic_config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DynamicConfig _$DynamicConfigFromJson(Map<String, dynamic> json) =>
    DynamicConfig(
      traceSamplingRate: (json['trace_sampling_rate'] as num).toDouble(),
      screenshotMaskLevel: $enumDecode(
          _$ScreenshotMaskLevelEnumMap, json['screenshot_mask_level']),
      crashTakeScreenshot: json['crash_take_screenshot'] as bool,
      gestureClickTakeSnapshot: json['gesture_click_take_snapshot'] as bool,
      httpDisableEventForUrls:
          (json['http_disable_event_for_urls'] as List<dynamic>)
              .map((e) => e as String)
              .toList(),
      httpTrackRequestForUrls:
          (json['http_track_request_for_urls'] as List<dynamic>)
              .map((e) => e as String)
              .toList(),
      httpTrackResponseForUrls:
          (json['http_track_response_for_urls'] as List<dynamic>)
              .map((e) => e as String)
              .toList(),
      httpBlockedHeaders: (json['http_blocked_headers'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$DynamicConfigToJson(DynamicConfig instance) =>
    <String, dynamic>{
      'trace_sampling_rate': instance.traceSamplingRate,
      'screenshot_mask_level':
          _$ScreenshotMaskLevelEnumMap[instance.screenshotMaskLevel]!,
      'crash_take_screenshot': instance.crashTakeScreenshot,
      'gesture_click_take_snapshot': instance.gestureClickTakeSnapshot,
      'http_disable_event_for_urls': instance.httpDisableEventForUrls,
      'http_track_request_for_urls': instance.httpTrackRequestForUrls,
      'http_track_response_for_urls': instance.httpTrackResponseForUrls,
      'http_blocked_headers': instance.httpBlockedHeaders,
    };

const _$ScreenshotMaskLevelEnumMap = {
  ScreenshotMaskLevel.allTextAndMedia: 'all_text_and_media',
  ScreenshotMaskLevel.allText: 'all_text',
  ScreenshotMaskLevel.none: 'none',
};
