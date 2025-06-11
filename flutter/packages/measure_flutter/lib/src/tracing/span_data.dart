import 'package:json_annotation/json_annotation.dart';

import '../serialization/json_serializable.dart';
import 'checkpoint.dart';
import 'span_status.dart';

part 'span_data.g.dart';

/// Internal data structure representing a span's complete state.
@JsonSerializable()
class SpanData implements JsonSerialized {
  const SpanData({
    required this.name,
    required this.traceId,
    required this.spanId,
    required this.parentId,
    required this.sessionId,
    required this.startTime,
    required this.endTime,
    required this.duration,
    required this.status,
    required this.attributes,
    required this.userDefinedAttrs,
    required this.checkpoints,
    required this.hasEnded,
    required this.isSampled,
  });

  final String name;
  final String traceId;
  final String spanId;
  final String? parentId;
  final String sessionId;
  final int startTime;
  final int endTime;
  final int duration;
  final SpanStatus status;
  final Map<String, dynamic> attributes;
  final Map<String, dynamic> userDefinedAttrs;
  final List<Checkpoint> checkpoints;
  final bool hasEnded;
  final bool isSampled;

  factory SpanData.fromJson(Map<String, dynamic> json) =>
      _$SpanDataFromJson(json);

  @override
  Map<String, dynamic> toJson() => _$SpanDataToJson(this);
}
