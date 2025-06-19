import 'package:measure_flutter/src/tracing/span.dart';
import 'package:measure_flutter/src/tracing/span_status.dart';

import '../attribute_value.dart';

class InvalidSpan implements Span {
  @override
  String get traceId => "invalid-trace-id";

  @override
  String get spanId => "invalid-span-id";

  @override
  bool get isSampled => false;

  @override
  String? get parentId => null;

  @override
  Span setStatus(SpanStatus status) {
    return this;
  }

  @override
  Span setParent(Span parentSpan) {
    return this;
  }

  @override
  Span setCheckpoint(String name) {
    return this;
  }

  @override
  Span setName(String name) {
    return this;
  }

  @override
  Span setAttributeString(String key, String value) {
    return this;
  }

  @override
  Span setAttributeInt(String key, int value) {
    return this;
  }

  @override
  Span setAttributeDouble(String key, double value) {
    return this;
  }

  @override
  Span setAttributeBool(String key, bool value) {
    return this;
  }

  @override
  Span setAttributes(Map<String, AttributeValue> attributes) {
    return this;
  }

  @override
  Span removeAttribute(String key) {
    return this;
  }

  @override
  Span end() {
    return this;
  }

  @override
  Span endWithTimestamp(int timestamp) {
    return this;
  }

  @override
  bool hasEnded() {
    return false;
  }

  @override
  int getDuration() {
    return 0;
  }
}
