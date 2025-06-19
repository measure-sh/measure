import 'package:measure_flutter/src/tracing/span_status.dart';

import 'checkpoint.dart';

final class SpanData {
  final String name;
  final String traceId;
  final String spanId;
  final String? parentId;
  final int startTime;
  final int endTime;
  final int duration;
  final SpanStatus status;
  final Map<String, dynamic> attributes;
  final Map<String, dynamic> userDefinedAttrs;
  final List<Checkpoint> checkpoints;
  final bool hasEnded;
  final bool isSampled;

  const SpanData({
    required this.name,
    required this.traceId,
    required this.spanId,
    this.parentId,
    required this.startTime,
    required this.endTime,
    required this.duration,
    required this.status,
    this.attributes = const {},
    this.userDefinedAttrs = const {},
    this.checkpoints = const [],
    required this.hasEnded,
    required this.isSampled,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SpanData &&
          runtimeType == other.runtimeType &&
          name == other.name &&
          traceId == other.traceId &&
          spanId == other.spanId &&
          parentId == other.parentId &&
          startTime == other.startTime &&
          endTime == other.endTime &&
          duration == other.duration &&
          status == other.status &&
          attributes == other.attributes &&
          userDefinedAttrs == other.userDefinedAttrs &&
          checkpoints == other.checkpoints &&
          hasEnded == other.hasEnded &&
          isSampled == other.isSampled;

  @override
  int get hashCode =>
      name.hashCode ^
      traceId.hashCode ^
      spanId.hashCode ^
      parentId.hashCode ^
      startTime.hashCode ^
      endTime.hashCode ^
      duration.hashCode ^
      status.hashCode ^
      attributes.hashCode ^
      userDefinedAttrs.hashCode ^
      checkpoints.hashCode ^
      hasEnded.hashCode ^
      isSampled.hashCode;

  @override
  String toString() {
    return 'SpanData{'
        'name: $name, '
        'traceId: $traceId, '
        'spanId: $spanId, '
        'parentId: $parentId, '
        'startTime: $startTime, '
        'endTime: $endTime, '
        'duration: $duration, '
        'status: $status, '
        'attributes: $attributes, '
        'userDefinedAttrs: $userDefinedAttrs, '
        'checkpoints: $checkpoints, '
        'hasEnded: $hasEnded, '
        'isSampled: $isSampled'
        '}';
  }
}
