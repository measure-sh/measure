import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/config/dynamic_config.dart';
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';

void main() {
  Map<String, dynamic> baseJson(String maskLevel) => {
        'trace_sampling_rate': 0.01,
        'screenshot_mask_level': maskLevel,
        'log_min_severity': 20,
        'crash_take_screenshot': true,
        'gesture_click_take_snapshot': true,
        'http_disable_event_for_urls': <String>[],
        'http_track_request_for_urls': <String>[],
        'http_track_response_for_urls': <String>[],
        'http_blocked_headers': <String>[],
      };

  group('DynamicConfig screenshot_mask_level', () {
    const cases = {
      'all_text_and_media': ScreenshotMaskLevel.allTextAndMedia,
      'all_text': ScreenshotMaskLevel.allText,
      'all_text_except_clickable': ScreenshotMaskLevel.allTextExceptClickable,
      'sensitive_fields_only': ScreenshotMaskLevel.sensitiveFieldsOnly,
    };

    cases.forEach((json, expected) {
      test('decodes "$json" without throwing', () {
        final config = DynamicConfig.fromJson(baseJson(json));
        expect(config.screenshotMaskLevel, expected);
      });
    });
  });

  group('DynamicConfig log_min_severity', () {
    test('decodes log_min_severity', () {
      final json = baseJson('all_text_and_media')..['log_min_severity'] = 16;
      final config = DynamicConfig.fromJson(json);
      expect(config.logMinSeverity, 16);
    });

    test('defaults to 16 (warning)', () {
      expect(DynamicConfig.defaults().logMinSeverity, 16);
    });
  });

  group('DynamicConfig log filters', () {
    test('decodes log_ignore_patterns', () {
      final json = baseJson('all_text_and_media')
        ..['log_ignore_patterns'] = ['secret'];
      final config = DynamicConfig.fromJson(json);
      expect(config.logIgnorePatterns, ['secret']);
    });

    test('defaults discard to empty', () {
      expect(DynamicConfig.defaults().logIgnorePatterns, isEmpty);
    });
  });
}
