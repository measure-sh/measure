import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/attribute_builder.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';

import '../utils/noop_logger.dart';
import '../utils/test_method_channel.dart';

void main() {
  late NoopLogger logger;
  late TestMethodChannel channel;
  late SignalProcessor signalProcessor;

  setUp(() {
    logger = NoopLogger();
    channel = TestMethodChannel();
    signalProcessor = DefaultSignalProcessor(logger: logger, channel: channel);
  });

  group('trackEvent', () {
    test('successfully tracks event with attributes', () {
      // Given
      final data = CustomEventData(name: "name");
      final eventType = EventType.custom;
      final timestamp = DateTime(2024, 2, 12, 10, 30);
      final builder = AttributeBuilder()
        ..add("string", "value")
        ..add("integer", 100);
      final attributes = builder.build();
      final userTriggered = true;
      final threadName = "main";

      // When
      signalProcessor.trackEvent(
        data: data,
        type: eventType,
        timestamp: timestamp,
        userDefinedAttrs: attributes,
        userTriggered: userTriggered,
        threadName: threadName,
      );

      // Then
      expect(channel.trackedEvents.length, 1);
      final trackedEvent = channel.trackedEvents.first;
      expect(trackedEvent.$1, data.toJson());
      expect(trackedEvent.$2, eventType);
      expect(trackedEvent.$3, timestamp.millisecondsSinceEpoch);
      expect(trackedEvent.$4, attributes);
      expect(trackedEvent.$5, userTriggered);
      expect(trackedEvent.$6, threadName);
    });

    test('handles empty attributes', () {
      // Given
      final data = CustomEventData(name: 'event_name');
      final eventType = EventType.custom;
      final timestamp = DateTime(2024, 2, 12, 10, 30);
      final attributes = <String, AttributeValue>{};
      final userTriggered = true;

      // When
      signalProcessor.trackEvent(
        data: data,
        type: eventType,
        timestamp: timestamp,
        userDefinedAttrs: attributes,
        userTriggered: userTriggered,
      );

      // Then
      expect(channel.trackedEvents.length, 1);
      final trackedEvent = channel.trackedEvents.first;
      expect(trackedEvent.$1, data.toJson());
      expect(trackedEvent.$2, eventType);
      expect(trackedEvent.$3, timestamp.millisecondsSinceEpoch);
      expect(trackedEvent.$4, isEmpty);
      expect(trackedEvent.$5, userTriggered);
    });
  });
}
