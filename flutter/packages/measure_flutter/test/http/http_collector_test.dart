import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/http/http_collector.dart';
import 'package:measure_flutter/src/http/http_data.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_signal_processor.dart';

void main() {
  group('HttpCollector', () {
    late HttpCollector collector;
    late FakeSignalProcessor signalProcessor;
    late FakeConfigProvider configProvider;

    setUp(() {
      signalProcessor = FakeSignalProcessor();
      configProvider = FakeConfigProvider();
      collector = HttpCollector(
        signalProcessor: signalProcessor,
        configProvider: configProvider,
      );
    });

    test('does not track events when disabled', () {
      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
        endTime: 1234567895,
      );

      expect(signalProcessor.trackedEvents.length, 0);
    });

    test('tracks basic HTTP GET event', () {
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
        endTime: 1234567895,
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final event = signalProcessor.trackedEvents.first;
      expect(event.type, EventType.http);
      expect(event.timestamp, 1234567890);
      expect(event.userTriggered, false);
      expect(event.userDefinedAttrs, {});

      final httpData = event.data as HttpData;
      expect(httpData.url, 'https://api.example.com/users');
      expect(httpData.method, 'get');
      expect(httpData.statusCode, 200);
      expect(httpData.startTime, 1234567890);
      expect(httpData.endTime, 1234567895);
      expect(httpData.client, 'unknown');
    });

    test('tracks HTTP POST event', () {
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.post,
        startTime: 1234567890,
        statusCode: 201,
        endTime: 1234567895,
        client: 'dio',
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.url, 'https://api.example.com/users');
      expect(httpData.method, 'post');
      expect(httpData.statusCode, 201);
      expect(httpData.client, 'dio');
    });

    test('tracks failed HTTP request', () {
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        endTime: 1234567895,
        failureReason: 'NETWORK_ERROR',
        failureDescription: 'Connection timeout',
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.failureReason, 'NETWORK_ERROR');
      expect(httpData.failureDescription, 'Connection timeout');
      expect(httpData.statusCode, null);
    });

    test('uses default client name when not provided', () {
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.client, 'unknown');
    });

    test('tracks different HTTP methods correctly', () {
      collector.register();

      final methods = [
        HttpMethod.get,
        HttpMethod.post,
        HttpMethod.put,
        HttpMethod.delete,
        HttpMethod.patch,
      ];

      for (final method in methods) {
        collector.trackHttpEvent(
          url: 'https://api.example.com/test',
          method: method,
          startTime: 1234567890,
          statusCode: 200,
        );
      }

      expect(signalProcessor.trackedEvents.length, methods.length);
      for (int i = 0; i < methods.length; i++) {
        final httpData = signalProcessor.trackedEvents[i].data as HttpData;
        expect(httpData.method, methods[i].name);
      }
    });

    group('HTTP config filtering', () {
      test('does not track event when URL is disabled by config', () {
        configProvider.shouldTrackHttpEventResult = false;
        collector.register();

        collector.trackHttpEvent(
          url: 'https://blocked.example.com/api',
          method: HttpMethod.get,
          startTime: 1234567890,
          statusCode: 200,
        );

        expect(signalProcessor.trackedEvents.length, 0);
      });

      test('filters blocked request headers', () {
        configProvider.shouldTrackHttpHeaderResults = {
          'authorization': false,
          'content-type': true,
          'user-agent': true,
        };
        collector.register();

        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.post,
          startTime: 1234567890,
          statusCode: 200,
          requestHeaders: {
            'authorization': 'Bearer token123',
            'content-type': 'application/json',
            'user-agent': 'MyApp/1.0',
          },
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;
        expect(httpData.requestHeaders?.containsKey('authorization'), false);
        expect(httpData.requestHeaders?['content-type'], 'application/json');
        expect(httpData.requestHeaders?['user-agent'], 'MyApp/1.0');
      });

      test('filters blocked response headers', () {
        configProvider.shouldTrackHttpHeaderResults = {
          'set-cookie': false,
          'content-type': true,
          'cache-control': true,
        };
        collector.register();

        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.get,
          startTime: 1234567890,
          statusCode: 200,
          responseHeaders: {
            'set-cookie': 'session=abc123',
            'content-type': 'application/json',
            'cache-control': 'no-cache',
          },
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;
        expect(httpData.responseHeaders?.containsKey('set-cookie'), false);
        expect(httpData.responseHeaders?['content-type'], 'application/json');
        expect(httpData.responseHeaders?['cache-control'], 'no-cache');
      });

      test('removes request body when URL is not configured for tracking', () {
        configProvider.shouldTrackHttpRequestBodyResult = false;
        collector.register();

        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.post,
          startTime: 1234567890,
          statusCode: 201,
          requestBody: '{"name": "John", "email": "john@example.com"}',
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;
        expect(httpData.requestBody, null);
      });

      test('tracks request body and headers when URL is configured for tracking', () {
        configProvider.shouldTrackHttpRequestBodyResult = true;
        collector.register();

        const requestBody = '{"name": "John", "email": "john@example.com"}';
        const requestHeaders = {"content-type": "application/json"};
        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.post,
          requestHeaders: requestHeaders,
          startTime: 1234567890,
          statusCode: 201,
          requestBody: requestBody,
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;
        expect(httpData.requestBody, requestBody);
        expect(httpData.requestHeaders, requestHeaders);
      });

      test('removes response body when URL is not configured for tracking', () {
        configProvider.shouldTrackHttpResponseBodyResult = false;
        collector.register();

        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.get,
          startTime: 1234567890,
          statusCode: 200,
          responseBody: '{"id": 1, "name": "John"}',
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;
        expect(httpData.responseBody, null);
      });

      test('tracks response body and headers when URL is configured for tracking', () {
        configProvider.shouldTrackHttpResponseBodyResult = true;
        collector.register();

        const responseBody = '{"id": 1, "name": "John"}';
        const responseHeaders = {"content-type": "application/json"};
        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.get,
          responseHeaders: responseHeaders,
          startTime: 1234567890,
          statusCode: 200,
          responseBody: responseBody,
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;
        expect(httpData.responseBody, responseBody);
        expect(httpData.responseHeaders, responseHeaders);
      });

      test('handles null headers gracefully', () {
        collector.register();

        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.get,
          startTime: 1234567890,
          statusCode: 200,
          requestHeaders: null,
          responseHeaders: null,
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;
        expect(httpData.requestHeaders, null);
        expect(httpData.responseHeaders, null);
      });

      test('applies all config filters together', () {
        configProvider.shouldTrackHttpHeaderResults = {
          'authorization': false,
          'content-type': true,
        };
        configProvider.shouldTrackHttpRequestBodyResult = false;
        configProvider.shouldTrackHttpResponseBodyResult = true;
        collector.register();

        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.post,
          startTime: 1234567890,
          statusCode: 200,
          requestHeaders: {
            'authorization': 'Bearer token',
            'content-type': 'application/json',
          },
          responseHeaders: {
            'content-type': 'application/json',
          },
          requestBody: '{"secret": "data"}',
          responseBody: '{"id": 1}',
        );

        expect(signalProcessor.trackedEvents.length, 1);
        final httpData = signalProcessor.trackedEvents.first.data as HttpData;

        // Request headers filtered
        expect(httpData.requestHeaders?.containsKey('authorization'), false);
        expect(httpData.requestHeaders?['content-type'], 'application/json');

        // Response headers not filtered (all allowed)
        expect(httpData.responseHeaders?['content-type'], 'application/json');

        // Request body removed
        expect(httpData.requestBody, null);

        // Response body kept
        expect(httpData.responseBody, '{"id": 1}');
      });
    });

    group('registration state', () {
      test('can be unregistered and re-registered', () {
        collector.register();
        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.get,
          startTime: 1234567890,
          statusCode: 200,
        );
        expect(signalProcessor.trackedEvents.length, 1);

        collector.unregister();
        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.get,
          startTime: 1234567891,
          statusCode: 200,
        );
        expect(signalProcessor.trackedEvents.length, 1); // Still 1, not tracked

        collector.register();
        collector.trackHttpEvent(
          url: 'https://api.example.com/users',
          method: HttpMethod.get,
          startTime: 1234567892,
          statusCode: 200,
        );
        expect(signalProcessor.trackedEvents.length, 2); // Now tracked again
      });
    });
  });
}
