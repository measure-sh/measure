import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/config/config.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/config/dynamic_config.dart';

void main() {
  late Config defaultConfig;
  late ConfigProviderImpl provider;

  setUp(() {
    defaultConfig = Config(
      enableLogging: false,
      autoStart: true,
    );

    provider = ConfigProviderImpl(
      defaultConfig: defaultConfig,
    );
  });

  group('shouldTrackHttpEvent', () {
    test('returns true when no URLs are blocked', () {
      expect(provider.shouldTrackHttpEvent('https://api.example.com/data'), isTrue);
    });

    test('returns false for exact match in block list', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://api.example.com/data'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://api.example.com/data'), isFalse);
    });

    test('returns false for wildcard match', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://api.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://api.example.com/users'), isFalse);
      expect(provider.shouldTrackHttpEvent('https://api.example.com/data/123'), isFalse);
    });

    test('returns true when URL does not match wildcard pattern', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://api.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://other.example.com/data'), isTrue);
    });

    test('handles wildcard in between path', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://api.example.com/*/users'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://api.example.com/data/users'), isFalse);
      expect(provider.shouldTrackHttpEvent('https://api.example.com/data/nomatch'), isTrue);
    });

    test('handles multiple wildcard patterns', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: [
          'https://analytics.example.com/*',
          'https://tracking.example.com/*',
        ],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://analytics.example.com/event'), isFalse);
      expect(provider.shouldTrackHttpEvent('https://tracking.example.com/ping'), isFalse);
      expect(provider.shouldTrackHttpEvent('https://api.example.com/data'), isTrue);
    });

    test('wildcard at beginning of pattern matches', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['*/api/v1/health'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://example.com/api/v1/health'), isFalse);
      expect(provider.shouldTrackHttpEvent('https://other.com/api/v1/health'), isFalse);
    });

    test('wildcard in middle of pattern matches', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://*/api/health'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://example.com/api/health'), isFalse);
    });

    test('pattern with special regex characters is escaped properly', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://api.example.com/path?query=value'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://api.example.com/path?query=value'), isFalse);
      // The ? should be literal, not regex "match 0 or 1"
      expect(provider.shouldTrackHttpEvent('https://api.example.com/pathquery=value'), isTrue);
    });
  });

  group('shouldTrackHttpRequestBody', () {
    test('returns false when no URLs are configured', () {
      expect(provider.shouldTrackHttpRequestBody('https://api.example.com/data'), isFalse);
    });

    test('returns true for request URL match', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpTrackRequestForUrls: ['https://api.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpRequestBody('https://api.example.com/users'), isTrue);
    });

    test('returns false when URL not in request list', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpTrackRequestForUrls: ['https://api.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpRequestBody('https://other.example.com/data'), isFalse);
    });
  });

  group('shouldTrackHttpResponseBody', () {
    test('returns false when no URLs are configured', () {
      expect(provider.shouldTrackHttpResponseBody('https://api.example.com/data'), isFalse);
    });

    test('returns true for response URL match', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpTrackResponseForUrls: ['https://api.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpResponseBody('https://api.example.com/users'), isTrue);
    });

    test('returns false when URL not in response list', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpTrackResponseForUrls: ['https://api.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpResponseBody('https://other.example.com/data'), isFalse);
    });
  });

  group('request and response body tracking', () {
    test('are independent', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpTrackRequestForUrls: ['https://request.example.com/*'],
        httpTrackResponseForUrls: ['https://response.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      // Request URL only matches request tracking
      expect(provider.shouldTrackHttpRequestBody('https://request.example.com/data'), isTrue);
      expect(provider.shouldTrackHttpResponseBody('https://request.example.com/data'), isFalse);

      // Response URL only matches response tracking
      expect(provider.shouldTrackHttpRequestBody('https://response.example.com/data'), isFalse);
      expect(provider.shouldTrackHttpResponseBody('https://response.example.com/data'), isTrue);

      // Unrelated URL matches neither
      expect(provider.shouldTrackHttpRequestBody('https://other.example.com/data'), isFalse);
      expect(provider.shouldTrackHttpResponseBody('https://other.example.com/data'), isFalse);
    });
  });

  group('shouldTrackHttpHeader', () {
    test('returns false for default blocked headers', () {
      expect(provider.shouldTrackHttpHeader('Authorization'), isFalse);
      expect(provider.shouldTrackHttpHeader('Cookie'), isFalse);
      expect(provider.shouldTrackHttpHeader('Set-Cookie'), isFalse);
      expect(provider.shouldTrackHttpHeader('Proxy-Authorization'), isFalse);
      expect(provider.shouldTrackHttpHeader('WWW-Authenticate'), isFalse);
      expect(provider.shouldTrackHttpHeader('X-Api-Key'), isFalse);
    });

    test('returns false for default blocked headers after dynamic config load', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpBlockedHeaders: ['New-Header-Key'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpHeader('New-Header-Key'), isFalse);
      expect(provider.shouldTrackHttpHeader('Authorization'), isFalse);
      expect(provider.shouldTrackHttpHeader('Cookie'), isFalse);
      expect(provider.shouldTrackHttpHeader('Set-Cookie'), isFalse);
      expect(provider.shouldTrackHttpHeader('Proxy-Authorization'), isFalse);
      expect(provider.shouldTrackHttpHeader('WWW-Authenticate'), isFalse);
      expect(provider.shouldTrackHttpHeader('X-Api-Key'), isFalse);
    });

    test('comparison is case insensitive', () {
      expect(provider.shouldTrackHttpHeader('Authorization'), isFalse);
      expect(provider.shouldTrackHttpHeader('authorization'), isFalse);
      expect(provider.shouldTrackHttpHeader('AUTHORIZATION'), isFalse);
    });

    test('returns false for dynamically loaded blocked header', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpBlockedHeaders: ['X-Custom-Header'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpHeader('X-Custom-Header'), isFalse);
    });

    test('returns true for non-blocked headers', () {
      expect(provider.shouldTrackHttpHeader('Content-Type'), isTrue);
      expect(provider.shouldTrackHttpHeader('Accept'), isTrue);
      expect(provider.shouldTrackHttpHeader('User-Agent'), isTrue);
    });
  });

  group('setMeasureUrl', () {
    test('adds URL to httpDisableEventForUrls', () {
      const measureUrl = 'https://measure.sh/api/v1';
      provider.setMeasureUrl(measureUrl);

      expect(provider.shouldTrackHttpEvent(measureUrl), isFalse);
    });

    test('is preserved after setDynamicConfig is called', () {
      const measureUrl = 'https://measure.sh/api/v1';
      provider.setMeasureUrl(measureUrl);

      // Simulate loading dynamic config from server
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://analytics.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      // Both should be blocked
      expect(provider.shouldTrackHttpEvent(measureUrl), isFalse);
      expect(provider.shouldTrackHttpEvent('https://analytics.example.com/event'), isFalse);
    });
  });

  group('setDynamicConfig', () {
    test('updates config values', () {
      final newConfig = DynamicConfig.defaults().copyWith(
        traceSamplingRate: 0.5,
        crashTakeScreenshot: false,
      );
      provider.setDynamicConfig(newConfig);

      expect(provider.traceSamplingRate, equals(0.5));
      expect(provider.crashTakeScreenshot, isFalse);
    });

    test('updates HTTP tracking patterns', () {
      final newConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://blocked.example.com/*'],
        httpTrackRequestForUrls: ['https://track-request.example.com/*'],
        httpTrackResponseForUrls: ['https://track-response.example.com/*'],
        httpBlockedHeaders: ['X-Custom-Auth'],
      );
      provider.setDynamicConfig(newConfig);

      expect(provider.shouldTrackHttpEvent('https://blocked.example.com/api'), isFalse);
      expect(provider.shouldTrackHttpRequestBody('https://track-request.example.com/api'), isTrue);
      expect(provider.shouldTrackHttpResponseBody('https://track-response.example.com/api'), isTrue);
      expect(provider.shouldTrackHttpHeader('X-Custom-Auth'), isFalse);
    });
  });

  group('static config properties', () {
    test('returns default config values', () {
      expect(provider.enableLogging, equals(defaultConfig.enableLogging));
      expect(provider.autoStart, equals(defaultConfig.autoStart));
      expect(provider.defaultHttpContentTypeAllowlist, equals(defaultConfig.defaultHttpContentTypeAllowlist));
      expect(provider.defaultHttpHeadersBlocklist, equals(defaultConfig.defaultHttpHeadersBlocklist));
    });
  });

  group('dynamic config properties', () {
    test('returns default dynamic config values initially', () {
      expect(provider.traceSamplingRate, equals(DynamicConfig.defaults().traceSamplingRate));
      expect(provider.screenshotMaskLevel, equals(DynamicConfig.defaults().screenshotMaskLevel));
      expect(provider.crashTakeScreenshot, equals(DynamicConfig.defaults().crashTakeScreenshot));
      expect(provider.gestureClickTakeSnapshot, equals(DynamicConfig.defaults().gestureClickTakeSnapshot));
    });

    test('lists are unmodifiable', () {
      final urls = provider.httpDisableEventForUrls;
      expect(() => urls.add('test'), throwsUnsupportedError);

      final requestUrls = provider.httpTrackRequestForUrls;
      expect(() => requestUrls.add('test'), throwsUnsupportedError);

      final responseUrls = provider.httpTrackResponseForUrls;
      expect(() => responseUrls.add('test'), throwsUnsupportedError);

      final headers = provider.httpBlockedHeaders;
      expect(() => headers.add('test'), throwsUnsupportedError);
    });

    test('URL matching is case insensitive', () {
      final dynamicConfig = DynamicConfig.defaults().copyWith(
        httpDisableEventForUrls: ['https://api.example.com/*'],
      );
      provider.setDynamicConfig(dynamicConfig);

      expect(provider.shouldTrackHttpEvent('https://API.example.com/users'), isFalse);
      expect(provider.shouldTrackHttpEvent('https://api.EXAMPLE.com/data'), isFalse);
      expect(provider.shouldTrackHttpEvent('HTTPS://api.example.com/path'), isFalse);
    });
  });
}
