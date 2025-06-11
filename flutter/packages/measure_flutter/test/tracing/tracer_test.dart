import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/tracing/msr_tracer.dart';
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

  group('MsrTracer', () {
    test('spanBuilder creates builder with correct name', () {
      final tracer = MsrTracer(
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      final builder = tracer.spanBuilder('test-span');
      final span = builder.startSpan() as MsrSpan;
      
      expect(span.toSpanData().name, equals('test-span'));
    });

    test('getTraceParentHeaderValue formats correctly for sampled span', () {
      final tracer = MsrTracer(
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      final span = MsrSpan.startSpan(
        name: 'test-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        isSampled: true,
      );

      final headerValue = tracer.getTraceParentHeaderValue(span);
      
      expect(headerValue, equals('00-${span.traceId}-${span.spanId}-01'));
    });

    test('getTraceParentHeaderValue formats correctly for unsampled span', () {
      final tracer = MsrTracer(
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      final span = MsrSpan.startSpan(
        name: 'test-span',
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
        isSampled: false,
      );

      final headerValue = tracer.getTraceParentHeaderValue(span);
      
      expect(headerValue, equals('00-${span.traceId}-${span.spanId}-00'));
    });

    test('getTraceParentHeaderKey returns correct key', () {
      final tracer = MsrTracer(
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      expect(tracer.getTraceParentHeaderKey(), equals('traceparent'));
    });

    test('spanBuilder creates spans with correct session ID', () {
      const sessionId = 'test-session-123';
      final tracer = MsrTracer(
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: sessionId,
      );

      final span = tracer.spanBuilder('test-span').startSpan() as MsrSpan;
      
      expect(span.toSpanData().sessionId, equals(sessionId));
    });

    test('spanBuilder creates spans that use span processor', () {
      final tracer = MsrTracer(
        logger: logger,
        idProvider: idProvider,
        spanProcessor: spanProcessor,
        sessionId: 'session-id',
      );

      final span = tracer.spanBuilder('test-span').startSpan();
      
      expect(spanProcessor.startedSpans, contains(span));
    });
  });
}