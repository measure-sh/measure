import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:mocktail/mocktail.dart';

import '../utils/mock_signal_processor.dart';
import '../utils/noop_logger.dart';

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
      final name = 'test_event';
      final attributes = <String, AttributeValue>{};
      final timestamp = DateTime.now();

      // When
      collector.trackCustomEvent(name, timestamp, attributes);

      // Then
      verifyZeroInteractions(signalProcessor);
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
      verify(
        () => signalProcessor.trackEvent(
            data: CustomEventData(name: name),
            type: EventType.custom,
            timestamp: timestamp,
            userDefinedAttrs: attributes,
            userTriggered: true,
            threadName: any(named: "threadName")),
      ).called(1);
    });

    test('should use current time when timestamp is null', () {
      // Given
      collector.register();
      final name = 'test_event';
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackCustomEvent(name, null, attributes);

      // Then
      verify(
        () => signalProcessor.trackEvent(
            data: CustomEventData(name: name),
            type: EventType.custom,
            timestamp: any(that: isNotNull, named: "timestamp"),
            userDefinedAttrs: attributes,
            userTriggered: true,
            threadName: any(named: "threadName")),
      ).called(1);
    });
  });
}
