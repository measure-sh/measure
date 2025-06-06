import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';

import '../utils/fake_signal_processor.dart';
import '../utils/noop_logger.dart';

void main() {
  group('CustomEventCollector', () {
    late CustomEventCollector collector;
    late NoopLogger logger;
    late FakeSignalProcessor signalProcessor;

    setUp(() {
      logger = NoopLogger();
      signalProcessor = FakeSignalProcessor();
      collector = CustomEventCollector(
        logger: logger,
        signalProcessor: signalProcessor,
      );
    });

    test('should be disabled by default', () {
      // When
      final isEnabled = collector.enabled;

      // Then
      expect(isEnabled, false);
    });

    test('should enable tracking when registered', () {
      // When
      collector.register();

      // Then
      expect(collector.enabled, true);
    });

    test('should disable tracking when unregistered', () {
      // Given
      collector.register();

      // When
      collector.unregister();

      // Then
      expect(collector.enabled, false);
    });

    test('should not track events when disabled', () {
      // Given
      final name = 'test_event';
      final attributes = <String, AttributeValue>{};
      final timestamp = DateTime.now();

      // When
      collector.trackCustomEvent(name, timestamp, attributes);

      // Then
      expect(signalProcessor.trackedCustomEvents.length, 0);
    });

    test('should track events when enabled', () {
      // Given
      collector.register();
      final name = 'test_event';
      final attributes = <String, AttributeValue>{};
      final timestamp = DateTime.now();

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
  });
}
