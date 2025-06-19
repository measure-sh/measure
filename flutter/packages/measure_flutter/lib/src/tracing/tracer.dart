import 'package:measure_flutter/src/tracing/span.dart';
import 'package:measure_flutter/src/tracing/span_builder.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';
import 'package:measure_flutter/src/tracing/trace_sampler.dart';

import '../logger/logger.dart';
import '../time/time_provider.dart';
import '../utils/id_provider.dart';
import 'msr_span_builder.dart';

abstract class Tracer {
  SpanBuilder spanBuilder(String name);

  String getTraceParentHeaderValue(Span span);

  String getTraceParentHeaderKey();
}

class MsrTracer implements Tracer {
  final Logger _logger;
  final IdProvider _idProvider;
  final TimeProvider _timeProvider;
  final SpanProcessor _spanProcessor;
  final TraceSampler _traceSampler;

  MsrTracer({
    required Logger logger,
    required IdProvider idProvider,
    required TimeProvider timeProvider,
    required SpanProcessor spanProcessor,
    required TraceSampler traceSampler,
  })  : _logger = logger,
        _idProvider = idProvider,
        _timeProvider = timeProvider,
        _spanProcessor = spanProcessor,
        _traceSampler = traceSampler;

  @override
  SpanBuilder spanBuilder(String name) {
    return MsrSpanBuilder(
      name: name,
      idProvider: _idProvider,
      timeProvider: _timeProvider,
      spanProcessor: _spanProcessor,
      traceSampler: _traceSampler,
      logger: _logger,
    );
  }

  @override
  String getTraceParentHeaderValue(Span span) {
    final sampledFlag = span.isSampled ? "01" : "00";
    return "00-${span.traceId}-${span.spanId}-$sampledFlag";
  }

  @override
  String getTraceParentHeaderKey() {
    return "traceparent";
  }
}
