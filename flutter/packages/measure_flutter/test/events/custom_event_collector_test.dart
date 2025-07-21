import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/noop_logger.dart';
import '../utils/test_clock.dart';

void main() {
  group('CustomEventCollector', () {
    late CustomEventCollector collector;
    late NoopLogger logger;
    late FakeSignalProcessor signalProcessor;
    late TimeProvider timeProvider;
    late FakeConfigProvider configProvider;

    setUp(() {
      logger = NoopLogger();
      signalProcessor = FakeSignalProcessor();
      configProvider = FakeConfigProvider();
      timeProvider = FlutterTimeProvider(TestClock.create());
      collector = CustomEventCollector(
        logger: logger,
        signalProcessor: signalProcessor,
        timeProvider: timeProvider,
        configProvider: configProvider,
      );
    });

    test('should be disabled by default', () {
      // When
      final isEnabled = collector.isEnabled();

      // Then
      expect(isEnabled, false);
    });

    test('should enable tracking when registered', () {
      // When
      collector.register();

      // Then
      expect(collector.isEnabled(), true);
    });

    test('should disable tracking when unregistered', () {
      // Given
      collector.register();

      // When
      collector.unregister();

      // Then
      expect(collector.isEnabled(), false);
    });

    test('should not track events when disabled', () {
      // Given
      final name = 'test_event';
      final attributes = <String, AttributeValue>{};
      final timestamp = timeProvider.now();

      // When
      collector.trackCustomEvent(name, timestamp, attributes);

      // Then
      expect(signalProcessor.trackedCustomEvents.length, 0);
    });

    test('should track events when isEnabled()', () {
      // Given
      collector.register();
      final name = 'test_event';
      final attributes = <String, AttributeValue>{};
      final timestamp = timeProvider.now();

      // When
      collector.trackCustomEvent(name, timestamp, attributes);

      // Then
      expect(signalProcessor.trackedCustomEvents.length, 1);
    });

    test('should use current time when timestamp is null', () {
      // Given
      collector.register();
      final name = 'test_event';
      final attributes = <String, AttributeValue>{};
      final customEventData = CustomEventData(name: name);
      // When
      collector.trackCustomEvent(name, null, attributes);

      // Then
      expect(signalProcessor.trackedCustomEvents.length, 1);

      expect(signalProcessor.trackedCustomEvents[0], customEventData);
    });

    test('should discard event with invalid name', () {
      // Given
      collector.register();
      final name = 'invalid event name with spaces';
      final attributes = <String, AttributeValue>{};
      // When
      collector.trackCustomEvent(name, null, attributes);

      // Then
      expect(signalProcessor.trackedCustomEvents.length, 0);
    });

    test('should discard event with empty event name', () {
      // Given
      collector.register();
      final name = '';
      final attributes = <String, AttributeValue>{};
      // When
      collector.trackCustomEvent(name, null, attributes);

      // Then
      expect(signalProcessor.trackedCustomEvents.length, 0);
    });

    test('should discard event with event name exceeding max length', () {
      // Given
      collector.register();
      final name =
          List.filled(configProvider.maxEventNameLength + 1, 'a').join();
      final attributes = <String, AttributeValue>{};
      // When
      collector.trackCustomEvent(name, null, attributes);

      // Then
      expect(signalProcessor.trackedCustomEvents.length, 0);
    });
  });
}
