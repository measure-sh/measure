import 'package:measure_flutter/src/tracing/internal_span.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';

class FakeSpanProcessor implements SpanProcessor {
  final List<InternalSpan> startedSpans = [];
  final List<InternalSpan> endingSpans = [];
  final List<InternalSpan> endedSpans = [];

  @override
  Future<void> onStart(InternalSpan span) async {
    startedSpans.add(span);
  }

  @override
  Future<void> onEnding(InternalSpan span) async {
    endingSpans.add(span);
  }

  @override
  Future<void> onEnded(InternalSpan span) async {
    endedSpans.add(span);
  }

  int get startedSpanCount => startedSpans.length;

  int get endingSpanCount => endingSpans.length;

  int get endedSpanCount => endedSpans.length;
}
