import 'package:measure_flutter/src/tracing/internal_span.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';

class FakeSpanProcessor implements SpanProcessor {
  final List<InternalSpan> startedSpans = [];
  final List<InternalSpan> endingSpans = [];
  final List<InternalSpan> endedSpans = [];

  @override
  void onStart(InternalSpan span) {
    startedSpans.add(span);
  }

  @override
  void onEnding(InternalSpan span) {
    endingSpans.add(span);
  }

  @override
  void onEnded(InternalSpan span) {
    endedSpans.add(span);
  }

  void clear() {
    startedSpans.clear();
    endingSpans.clear();
    endedSpans.clear();
  }
}