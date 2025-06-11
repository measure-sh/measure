import 'package:measure_flutter/src/tracing/span_processor.dart';

import '../logger/logger.dart';
import '../utils/id_provider.dart';
import 'msr_span_builder.dart';
import 'span.dart';
import 'span_builder.dart';
import 'tracer.dart';

/// Implementation of [Tracer] for creating spans.
class MsrTracer implements Tracer {
  MsrTracer({
    required Logger logger,
    required IdProvider idProvider,
    SpanProcessor? spanProcessor,
    String? sessionId,
  })  : _logger = logger,
        _idProvider = idProvider,
        _spanProcessor = spanProcessor,
        _sessionId = sessionId;

  final Logger _logger;
  final IdProvider _idProvider;
  final SpanProcessor? _spanProcessor;
  final String? _sessionId;

  @override
  SpanBuilder spanBuilder(String name) {
    return MsrSpanBuilder(
      name: name,
      idProvider: _idProvider,
      logger: _logger,
      spanProcessor: _spanProcessor,
      sessionId: _sessionId,
    );
  }

  @override
  String getTraceParentHeaderValue(Span span) {
    final sampledFlag = span.isSampled ? '01' : '00';
    return '00-${span.traceId}-${span.spanId}-$sampledFlag';
  }

  @override
  String getTraceParentHeaderKey() {
    return 'traceparent';
  }
}
