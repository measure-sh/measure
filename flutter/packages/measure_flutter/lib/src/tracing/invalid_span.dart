import 'span.dart';
import 'span_status.dart';

/// A no-op implementation of [Span] used when spans are not being collected.
class InvalidSpan implements Span {
  @override
  String get traceId => '';

  @override
  String get spanId => '';

  @override
  String? get parentId => null;

  @override
  bool get isSampled => false;

  @override
  Span setStatus(SpanStatus status) => this;

  @override
  Span setParent(Span parentSpan) => this;

  @override
  Span setCheckpoint(String name) => this;

  @override
  Span setName(String name) => this;

  @override
  Span setAttribute(String key, String value) => this;

  @override
  Span setIntAttribute(String key, int value) => this;

  @override
  Span setDoubleAttribute(String key, double value) => this;

  @override
  Span setBoolAttribute(String key, bool value) => this;

  @override
  Span setAttributes(Map<String, dynamic> attributes) => this;

  @override
  Span removeAttribute(String key) => this;

  @override
  Span end({int? timestamp}) => this;

  @override
  bool hasEnded() => true;

  @override
  int getDuration() => 0;
}
