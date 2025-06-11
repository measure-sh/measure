import 'package:measure_flutter/src/tracing/span_processor.dart';

import 'span.dart';
import 'span_builder.dart';
import 'msr_span.dart';
import '../utils/id_provider.dart';
import '../logger/logger.dart';

/// Implementation of [SpanBuilder] for creating [MsrSpan] instances.
class MsrSpanBuilder implements SpanBuilder {
  MsrSpanBuilder({
    required this.name,
    required IdProvider idProvider,
    required Logger logger,
    SpanProcessor? spanProcessor,
    String? sessionId,
  })  : _idProvider = idProvider,
        _logger = logger,
        _spanProcessor = spanProcessor,
        _sessionId = sessionId;

  final String name;
  final IdProvider _idProvider;
  final Logger _logger;
  final SpanProcessor? _spanProcessor;
  final String? _sessionId;
  Span? _parentSpan;

  @override
  SpanBuilder setParent(Span span) {
    _parentSpan = span;
    return this;
  }

  @override
  Span startSpan() {
    return MsrSpan.startSpan(
      name: name,
      logger: _logger,
      idProvider: _idProvider,
      spanProcessor: _spanProcessor,
      sessionId: _sessionId,
      parentSpan: _parentSpan,
    );
  }

  @override
  Span startSpanWithTime(int timeMs) {
    return MsrSpan.startSpan(
      name: name,
      logger: _logger,
      idProvider: _idProvider,
      spanProcessor: _spanProcessor,
      sessionId: _sessionId,
      parentSpan: _parentSpan,
      timestamp: timeMs,
    );
  }
}