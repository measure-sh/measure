import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/config/config.dart';
import 'package:measure_flutter/src/config/config_provider.dart';

void main() {
  late Config defaultConfig;
  late ConfigProviderImpl provider;

  setUp(() {
    defaultConfig = Config(
      enableLogging: false,
      trackHttpHeaders: false,
      trackHttpBody: false,
      httpHeadersBlocklist: [],
      httpUrlBlocklist: [],
      httpUrlAllowlist: [],
    );

    provider = ConfigProviderImpl(
      defaultConfig: defaultConfig,
    );
  });

  group('shouldTrackHttpUrl', () {
    test('allows URL if allowlist contains it', () {
      provider = ConfigProviderImpl(
        defaultConfig:
            defaultConfig.copyWith(httpUrlAllowlist: ['allowed.com']),
      );

      expect(provider.shouldTrackHttpUrl('https://allowed.com'), isTrue);
      expect(provider.shouldTrackHttpUrl('https://other.com'), isFalse);
    });

    test('blocks URL if blocklist contains it', () {
      provider = ConfigProviderImpl(
        defaultConfig:
            defaultConfig.copyWith(httpUrlBlocklist: ['blocked.com']),
      );

      expect(provider.shouldTrackHttpUrl('https://blocked.com'), isFalse);
      expect(provider.shouldTrackHttpUrl('https://other.com'), isTrue);
    });
  });

  group('shouldTrackHttpBody', () {
    test('returns false if trackHttpBody is false', () {
      expect(
          provider.shouldTrackHttpBody('https://any.com', 'application/json'),
          isFalse);
    });

    test('returns false if contentType is null or empty', () {
      provider = ConfigProviderImpl(
        defaultConfig: defaultConfig.copyWith(trackHttpBody: true),
      );
      expect(provider.shouldTrackHttpBody('https://any.com', null), isFalse);
      expect(provider.shouldTrackHttpBody('https://any.com', ''), isFalse);
    });

    test('returns false if contentType is not allowed', () {
      // by default we allow only [application/json] content type
      provider = ConfigProviderImpl(
        defaultConfig: defaultConfig.copyWith(
          trackHttpBody: true,
        ),
      );
      expect(
        provider.shouldTrackHttpBody('https://any.com', 'text/html'),
        isFalse,
      );
    });

    test('returns true only if contentType allowed and url is allowed', () {
      // by default we allow only [application/json] content type
      provider = ConfigProviderImpl(
        defaultConfig: defaultConfig.copyWith(
          trackHttpBody: true,
          httpUrlAllowlist: ['allowed.com'],
        ),
      );
      expect(
        provider.shouldTrackHttpBody('https://allowed.com', 'application/json'),
        isTrue,
      );
      expect(
        provider.shouldTrackHttpBody('https://allowed.com', 'text/html'),
        isFalse,
      );
    });
  });

  group('shouldTrackHttpHeader', () {
    test('returns false if tracking is disabled', () {
      expect(provider.shouldTrackHttpHeader('Authorization'), isFalse);
    });

    test('returns false if header is blocklisted', () {
      provider = ConfigProviderImpl(
        defaultConfig: defaultConfig.copyWith(
          trackHttpHeaders: true,
          httpHeadersBlocklist: ['Authorization'],
        ),
      );
      expect(provider.shouldTrackHttpHeader('Authorization'), isFalse);
      expect(provider.shouldTrackHttpHeader('Content-Type'), isTrue);
    });
  });
}
