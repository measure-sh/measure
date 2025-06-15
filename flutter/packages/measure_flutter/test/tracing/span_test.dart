import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/tracing/msr_span.dart';
import 'package:measure_flutter/src/tracing/span_status.dart';
import 'package:measure_flutter/src/tracing/checkpoint.dart';
import '../utils/noop_logger.dart';
import '../utils/fake_id_provider.dart';
import '../utils/fake_span_processor.dart';

void main() {
  late NoopLogger logger;
  late FakeIdProvider idProvider;
  late FakeSpanProcessor spanProcessor;

  setUp(() {
    logger = NoopLogger();
    idProvider = FakeIdProvider();
    spanProcessor = FakeSpanProcessor();
  });

  group('MsrSpan', () {
    test('startSpan sets parent span if provided', () {
      final parentSpan = MsrSpan.startSpan(
        name: 'parent-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        timestamp: 1000,
      );


      final span = MsrSpan.startSpan(
        name: 'child-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        parentSpan: parentSpan,
      );

      expect(span.parentId, equals(parentSpan.spanId));
      expect(span.traceId, equals(parentSpan.traceId));
    });

    test('startSpan sets current timestamp when none provided', () {
      final beforeTime = DateTime.now().millisecondsSinceEpoch;
      
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ) as MsrSpan;

      final afterTime = DateTime.now().millisecondsSinceEpoch;
      
      expect(span.startTime, greaterThanOrEqualTo(beforeTime));
      expect(span.startTime, lessThanOrEqualTo(afterTime));
    });

    test('startSpan sets timestamp if provided', () {
      const timestamp = 10000;
      
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        timestamp: timestamp,
      ) as MsrSpan;

      expect(span.startTime, equals(timestamp));
    });

    test('startSpan triggers span processor onStart', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      expect(spanProcessor.startedSpans, contains(span));
    });

    test('default span status is unset', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ) as MsrSpan;

      expect(span.getStatus(), equals(SpanStatus.unset));
    });

    test('setStatus updates the span status', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).setStatus(SpanStatus.ok) as MsrSpan;

      expect(span.getStatus(), equals(SpanStatus.ok));
    });

    test('hasEnded returns false for active span', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      expect(span.hasEnded(), isFalse);
    });

    test('hasEnded returns true for ended span', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).end();

      expect(span.hasEnded(), isTrue);
    });

    test('end updates the span duration', () {
      final startTime = DateTime.now().millisecondsSinceEpoch;
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        timestamp: startTime,
      );

      // Wait a bit then end the span
      final endTime = startTime + 1000;
      span.end(timestamp: endTime);
      
      expect(span.getDuration(), equals(1000));
    });

    test('end triggers span processor onEnded', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).end() as MsrSpan;

      expect(spanProcessor.endedSpans, contains(span));
    });

    test('setCheckpoint adds checkpoint to span', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ) as MsrSpan;
      
      span.setCheckpoint('checkpoint-name');
      final spanData = span.toSpanData();

      expect(spanData.checkpoints, hasLength(1));
      expect(spanData.checkpoints.first.name, equals('checkpoint-name'));
    });

    test('setCheckpoint on ended span is a no-op', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).end() as MsrSpan;
      
      span.setCheckpoint('checkpoint-name');
      final spanData = span.toSpanData();

      expect(spanData.checkpoints, isEmpty);
    });

    test('setAttribute adds attribute to span', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ) as MsrSpan;
      
      span.setAttribute('key', 'value');

      expect(span.getUserDefinedAttrs()['key'], equals('value'));
    });

    test('setAttribute on ended span is a no-op', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).end() as MsrSpan;
      
      span.setAttribute('key', 'value');

      expect(span.getUserDefinedAttrs(), isEmpty);
    });

    test('setAttributes adds multiple attributes to span', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ) as MsrSpan;
      
      span.setAttributes({'key1': 'value1', 'key2': 'value2'});

      final attrs = span.getUserDefinedAttrs();
      expect(attrs['key1'], equals('value1'));
      expect(attrs['key2'], equals('value2'));
    });

    test('removeAttribute removes attribute from span', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ) as MsrSpan;
      
      span.setAttribute('key', 'value');
      span.removeAttribute('key');

      expect(span.getUserDefinedAttrs(), isEmpty);
    });

    test('getDuration returns 0 for active span', () {
      final span = MsrSpan.startSpan(
        name: 'span-name',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      expect(span.getDuration(), equals(0));
    });

    test('startSpan sets sampling state based on parent span', () {
      final sampledParentSpan = MsrSpan.startSpan(
        name: 'parent-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        isSampled: true,
      );


      final childSpan = MsrSpan.startSpan(
        name: 'child-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        parentSpan: sampledParentSpan,
        isSampled: false, // Should be ignored due to parent
      );

      expect(childSpan.isSampled, isTrue);
    });

    test('setParent updates parent ID and trace ID correctly', () {
      final parentSpan = MsrSpan.startSpan(
        name: 'parent-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );


      final childSpan = MsrSpan.startSpan(
        name: 'child-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      childSpan.setParent(parentSpan);

      expect(childSpan.traceId, equals(parentSpan.traceId));
      expect(childSpan.parentId, equals(parentSpan.spanId));
    });
  });
}