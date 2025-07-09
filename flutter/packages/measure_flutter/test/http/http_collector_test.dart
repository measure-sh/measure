import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure.dart';
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

    test('does not track when URL is blocked', () {
      configProvider.httpUrlBlocklist = ['api.example.com'];
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
      );

      expect(signalProcessor.trackedEvents.length, 0);
    });

    test('tracks URL when allowlist is empty and URL not in blocklist', () {
      configProvider.httpUrlAllowlist = [];
      configProvider.httpUrlBlocklist = [];
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
      );

      expect(signalProcessor.trackedEvents.length, 1);
    });

    test('tracks URL when in allowlist and not in blocklist', () {
      configProvider.httpUrlAllowlist = ['api.example.com'];
      configProvider.httpUrlBlocklist = [];
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
      );

      expect(signalProcessor.trackedEvents.length, 1);
    });

    test('does not track URL when not in allowlist', () {
      configProvider.httpUrlAllowlist = ['api.allowed.com'];
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
      );

      expect(signalProcessor.trackedEvents.length, 0);
    });

    test('filters request headers based on config', () {
      configProvider.trackHttpHeaders = true;
      configProvider.httpHeadersBlocklist = ['authorization'];
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.post,
        startTime: 1234567890,
        statusCode: 201,
        requestHeaders: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer secret-token',
          'User-Agent': 'MyApp/1.0',
        },
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.requestHeaders, {
        'Content-Type': 'application/json',
        'User-Agent': 'MyApp/1.0',
      });
    });

    test('filters response headers based on config', () {
      configProvider.trackHttpHeaders = true;
      configProvider.httpHeadersBlocklist = ['set-cookie'];
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
        responseHeaders: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=abc123',
          'Cache-Control': 'no-cache',
        },
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.responseHeaders, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
    });

    test('does not track headers when trackHttpHeaders is false', () {
      configProvider.trackHttpHeaders = false;
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.post,
        startTime: 1234567890,
        statusCode: 201,
        requestHeaders: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.requestHeaders, {});
    });

    test('filters request body when config says not to track', () {
      configProvider.trackHttpBody = false;
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.post,
        startTime: 1234567890,
        statusCode: 201,
        requestHeaders: {'Content-Type': 'application/json'},
        requestBody: '{"sensitive": "data"}',
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.requestBody, null);
    });

    test('filters response body when config says not to track', () {
      configProvider.trackHttpBody = false;
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
        responseHeaders: {'Content-Type': 'application/json'},
        responseBody: '{"sensitive": "response"}',
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.responseBody, null);
    });

    test('tracks request body when config allows it', () {
      configProvider.trackHttpBody = true;
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.post,
        startTime: 1234567890,
        statusCode: 201,
        requestHeaders: {'Content-Type': 'application/json'},
        requestBody: '{"name": "John"}',
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.requestBody, '{"name": "John"}');
    });

    test('tracks response body when config allows it', () {
      configProvider.trackHttpBody = true;
      collector.register();

      collector.trackHttpEvent(
        url: 'https://api.example.com/users',
        method: HttpMethod.get,
        startTime: 1234567890,
        statusCode: 200,
        responseHeaders: {'Content-Type': 'application/json'},
        responseBody: '{"id": 123}',
      );

      expect(signalProcessor.trackedEvents.length, 1);
      final httpData = signalProcessor.trackedEvents.first.data as HttpData;
      expect(httpData.responseBody, '{"id": 123}');
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
  });
}