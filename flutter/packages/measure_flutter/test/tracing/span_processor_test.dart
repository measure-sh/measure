import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/tracing/msr_span.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_id_provider.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/noop_logger.dart';

void main() {
  late NoopLogger logger;
  late FakeSignalProcessor signalProcessor;
  late FakeConfigProvider configProvider;

  setUp(() {
    logger = NoopLogger();
    signalProcessor = FakeSignalProcessor();
    configProvider = FakeConfigProvider();
  });

  group('MsrSpanProcessor', () {
    test('onStart adds thread name to attributes', () {
      final spanProcessor = MsrSpanProcessor(
        logger: logger,
        signalProcessor: signalProcessor,
        configProvider: configProvider,
      );

      final span = MsrSpan.startSpan(
        name: 'test-span',
        logger: logger,
        idProvider: FakeIdProvider(),
        sessionId: 'session-id',
      ) as MsrSpan;

      spanProcessor.onStart(span);

      final attributes = span.getAttributesMap();
      expect(attributes.length, equals(1));
      expect(attributes['thread_name'], isNotEmpty);
    });

    test('onEnded delegates to signal processor', () {
      final spanProcessor = MsrSpanProcessor(
        logger: logger,
        signalProcessor: signalProcessor,
        configProvider: configProvider,
      );

      final span = MsrSpan.startSpan(
        name: 'test-span',
        logger: logger,
        idProvider: FakeIdProvider(),
        sessionId: 'session-id',
      ).end() as MsrSpan;

      spanProcessor.onEnded(span);

      expect(signalProcessor.trackedSpans, hasLength(1));
      expect(signalProcessor.trackedSpans.first.name, equals('test-span'));
    });

    test('discards span if it exceeds max length', () {
      final spanProcessor = MsrSpanProcessor(
        logger: logger,
        signalProcessor: signalProcessor,
        configProvider: configProvider,
      );

      final longName = 's' * (configProvider.maxSpanNameLength + 1);
      final span = MsrSpan.startSpan(
        name: longName,
        logger: logger,
        idProvider: FakeIdProvider(),
        sessionId: 'session-id',
      ).end() as MsrSpan;

      spanProcessor.onEnded(span);

      expect(signalProcessor.trackedSpans, isEmpty);
    });

    test('discards span if duration is negative', () {
      final spanProcessor = MsrSpanProcessor(
        logger: logger,
        signalProcessor: signalProcessor,
        configProvider: configProvider,
      );

      // Create span with negative duration by setting end time before start time
      final span = MsrSpan.startSpan(
        name: 'test-span',
        logger: logger,
        idProvider: FakeIdProvider(),
        sessionId: 'session-id',
        timestamp: 1000,
      ).end(timestamp: 500) as MsrSpan; // End before start

      spanProcessor.onEnded(span);

      expect(signalProcessor.trackedSpans, isEmpty);
    });

    test('limits checkpoints to max checkpoints per span', () {
      final spanProcessor = MsrSpanProcessor(
        logger: logger,
        signalProcessor: signalProcessor,
        configProvider: configProvider,
      );

      final span = MsrSpan.startSpan(
        name: 'test-span',
        logger: logger,
        idProvider: FakeIdProvider(),
        sessionId: 'session-id',
      ) as MsrSpan;

      // Add more checkpoints than allowed
      for (int i = 0; i <= configProvider.maxCheckpointsPerSpan; i++) {
        span.setCheckpoint('checkpoint-$i');
      }

      span.end();
      spanProcessor.onEnded(span);

      expect(signalProcessor.trackedSpans, hasLength(1));
      final spanData = signalProcessor.trackedSpans.first;
      expect(spanData.checkpoints.length,
          equals(configProvider.maxCheckpointsPerSpan));
    });

    test('removes checkpoints with names exceeding max length', () {
      final spanProcessor = MsrSpanProcessor(
        logger: logger,
        signalProcessor: signalProcessor,
        configProvider: configProvider,
      );

      final span = MsrSpan.startSpan(
        name: 'test-span',
        logger: logger,
        idProvider: FakeIdProvider(),
        sessionId: 'session-id',
      ) as MsrSpan;

      span.setCheckpoint('valid-checkpoint');
      span.setCheckpoint(
          's' * (configProvider.maxCheckpointNameLength + 1)); // Too long

      span.end();
      spanProcessor.onEnded(span);

      expect(signalProcessor.trackedSpans, hasLength(1));
      final spanData = signalProcessor.trackedSpans.first;
      expect(spanData.checkpoints.length, equals(1));
      expect(spanData.checkpoints.first.name, equals('valid-checkpoint'));
    });
  });
}
