import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/attribute_builder.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';

import '../noop_logger.dart';
import '../test_method_channel.dart';

void main() {
  late NoopLogger logger;
  late TestMethodChannel channel;
  late SignalProcessor signalProcessor;

  setUp(() {
    logger = NoopLogger();
    channel = TestMethodChannel();
    signalProcessor = DefaultSignalProcessor(logger: logger, channel: channel);
  });

  group('trackCustomEvent', () {
    test('successfully tracks event with attributes', () {
      // Given
      final eventName = 'test_event';
      final timestamp = DateTime(2024, 2, 12, 10, 30);
      final builder = AttributeBuilder()
        ..add("string", "value")
        ..add("integer", 100);
      final attributes = builder.build();

      // When
      signalProcessor.trackCustomEvent(eventName, timestamp, attributes);

      // Then
      expect(channel.trackedEvents.length, 1);
      final trackedEvent = channel.trackedEvents.first;
      expect(trackedEvent.$1, eventName);
      expect(trackedEvent.$2, timestamp.millisecondsSinceEpoch);
      expect(trackedEvent.$3, attributes);
    });

    test('handles empty attributes', () {
      // Given
      final eventName = 'test_event';
      final timestamp = DateTime(2024, 2, 12, 10, 30);
      final attributes = <String, AttributeValue>{};

      // When
      signalProcessor.trackCustomEvent(eventName, timestamp, attributes);

      // Then
      expect(channel.trackedEvents.length, 1);
      final trackedEvent = channel.trackedEvents.first;
      expect(trackedEvent.$1, eventName);
      expect(trackedEvent.$2, timestamp.millisecondsSinceEpoch);
      expect(trackedEvent.$3, isEmpty);
    });
  });
}
