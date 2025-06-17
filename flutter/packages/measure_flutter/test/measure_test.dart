import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure.dart';

import 'utils/test_method_channel.dart';

void main() {
  group('Measure initialization', () {
    test('should start successfully with valid client info', () async {
      final measure = Measure.withMethodChannel(TestMethodChannel());

      var isStarted = false;

      await measure.init(
        () {
          isStarted = true;
        },
        clientInfo: ClientInfo(
          apiKey: "msrsh-123",
          apiUrl: "https://example.com",
        ),
        config: const MeasureConfig(),
      );

      expect(measure.isInitialized, true);
      expect(isStarted, true);
    });

    test('should start if apiKey is empty and keep SDK uninitialized', () async {
      final measure = Measure.withMethodChannel(TestMethodChannel());

      var isStarted = false;

      await measure.init(
        () {
          isStarted = true;
        },
        clientInfo: ClientInfo(
          apiKey: "",
          apiUrl: "https://example.com",
        ),
        config: const MeasureConfig(),
      );

      expect(measure.isInitialized, false);
      expect(isStarted, true);
    });

    test('should start if apiKey is invalid and keep SDK uninitialized', () async {
      final measure = Measure.withMethodChannel(TestMethodChannel());

      var isStarted = false;

      await measure.init(
        () {
          isStarted = true;
        },
        clientInfo: ClientInfo(
          apiKey: "invalid-key",
          apiUrl: "https://example.com",
        ),
        config: const MeasureConfig(),
      );

      expect(measure.isInitialized, false);
      expect(isStarted, true);
    });

    test('should start if apiUrl is empty and keep SDK uninitialized', () async {
      final measure = Measure.withMethodChannel(TestMethodChannel());

      var isStarted = false;

      await measure.init(
        () {
          isStarted = true;
        },
        clientInfo: ClientInfo(
          apiKey: "msrsh-123",
          apiUrl: "",
        ),
        config: const MeasureConfig(),
      );

      expect(measure.isInitialized, false);
      expect(isStarted, true);
    });
  });


}
