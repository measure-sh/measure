import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:mocktail/mocktail.dart';

import '../utils/noop_logger.dart';
import '../utils/mock_signal_processor.dart';

void main() {
  group('CustomEventCollector', () {
    late CustomEventCollector collector;
    late NoopLogger logger;
    late MockSignalProcessor signalProcessor;

    setUp(() {
      logger = NoopLogger();
      signalProcessor = MockSignalProcessor();
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
      final event = 'test_event';
      final attributes = <String, AttributeValue>{};
      final timestamp = DateTime.now();

      // When
      collector.trackCustomEvent(event, timestamp, attributes);

      // Then
      verifyNever(() => signalProcessor.trackCustomEvent(any(), any(), any()));
    });

    test('should track events when enabled', () {
      // Given
      collector.register();
      final event = 'test_event';
      final attributes = <String, AttributeValue>{};
      final timestamp = DateTime.now();

      // When
      collector.trackCustomEvent(event, timestamp, attributes);

      // Then
      verify(() =>
              signalProcessor.trackCustomEvent(event, timestamp, attributes))
          .called(1);
    });

    test('should use current time when timestamp is null', () {
      // Given
      collector.register();
      final event = 'test_event';
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackCustomEvent(event, null, attributes);

      // Then
      verify(
        () => signalProcessor.trackCustomEvent(
          event,
          any(that: isNotNull),
          attributes,
        ),
      ).called(1);
    });
  });
}
