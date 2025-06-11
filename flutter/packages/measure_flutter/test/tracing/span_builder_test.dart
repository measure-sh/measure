import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/tracing/msr_span_builder.dart';
import 'package:measure_flutter/src/tracing/msr_span.dart';
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

  group('MsrSpanBuilder', () {
    test('setParent sets span parent', () {
      final parentSpan = MsrSpanBuilder(
        name: 'parent-name',
        idProvider: idProvider,
        logger: logger,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).startSpan();


      final span = MsrSpanBuilder(
        name: 'child-name',
        idProvider: idProvider,
        logger: logger,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).setParent(parentSpan).startSpan();

      expect(span.parentId, equals(parentSpan.spanId));
      expect(span.traceId, equals(parentSpan.traceId));
    });

    test('startSpan creates span with current time', () {
      final beforeTime = DateTime.now().millisecondsSinceEpoch;
      
      final span = MsrSpanBuilder(
        name: 'span-name',
        idProvider: idProvider,
        logger: logger,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).startSpan() as MsrSpan;

      final afterTime = DateTime.now().millisecondsSinceEpoch;
      
      expect(span.startTime, greaterThanOrEqualTo(beforeTime));
      expect(span.startTime, lessThanOrEqualTo(afterTime));
    });

    test('startSpanWithTime creates span with specified time', () {
      const timestamp = 12345;
      
      final span = MsrSpanBuilder(
        name: 'span-name',
        idProvider: idProvider,
        logger: logger,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).startSpanWithTime(timestamp) as MsrSpan;

      expect(span.startTime, equals(timestamp));
    });

    test('builder returns self for method chaining', () {
      final builder = MsrSpanBuilder(
        name: 'span-name',
        idProvider: idProvider,
        logger: logger,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      final parentSpan = MsrSpanBuilder(
        name: 'parent-name',
        idProvider: idProvider,
        logger: logger,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      ).startSpan();

      final result = builder.setParent(parentSpan);
      
      expect(result, same(builder));
    });

    test('created span has correct properties', () {
      const spanName = 'test-span';
      const sessionId = 'test-session';
      
      final span = MsrSpanBuilder(
        name: spanName,
        idProvider: idProvider,
        logger: logger,
        spanProcessor: spanProcessor,
        sessionId: sessionId,
      ).startSpan() as MsrSpan;

      final spanData = span.toSpanData();
      expect(spanData.name, equals(spanName));
      expect(spanData.sessionId, equals(sessionId));
      expect(spanData.spanId, equals('fake-span-id-1'));
      expect(spanData.traceId, equals('fake-trace-id-1'));
    });
  });
}