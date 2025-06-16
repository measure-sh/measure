import 'package:measure_flutter/src/tracing/span.dart';
import 'package:measure_flutter/src/tracing/span_builder.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';
import 'package:measure_flutter/src/tracing/trace_sampler.dart';

import '../logger/logger.dart';
import '../time/time_provider.dart';
import '../utils/id_provider.dart';
import 'msr_span.dart';

class MsrSpanBuilder extends SpanBuilder {
  final String name;
  final IdProvider _idProvider;
  final TimeProvider _timeProvider;
  final SpanProcessor _spanProcessor;
  final TraceSampler _traceSampler;
  final Logger _logger;

  Span? _parentSpan;

  MsrSpanBuilder({
    required this.name,
    required IdProvider idProvider,
    required TimeProvider timeProvider,
    required SpanProcessor spanProcessor,
    required TraceSampler traceSampler,
    required Logger logger,
  })  : _idProvider = idProvider,
        _timeProvider = timeProvider,
        _spanProcessor = spanProcessor,
        _traceSampler = traceSampler,
        _logger = logger;

  @override
  SpanBuilder setParent(Span span) {
    _parentSpan = span;
    return this;
  }

  @override
  Span startSpan({int? timestamp}) {
    return MsrSpan.startSpan(
      name: name,
      logger: _logger,
      timeProvider: _timeProvider,
      spanProcessor: _spanProcessor,
      idProvider: _idProvider,
      parentSpan: _parentSpan,
      traceSampler: _traceSampler,
      timestamp: timestamp,
    );
  }
}
