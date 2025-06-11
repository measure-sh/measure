import 'package:json_annotation/json_annotation.dart';

import '../serialization/json_serializable.dart';

part 'checkpoint.g.dart';

/// Annotates a specific time on a span.
@JsonSerializable()
class Checkpoint implements JsonSerialized {
  const Checkpoint(this.name, this.timestamp);

  final String name;
  final int timestamp;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! Checkpoint) return false;
    return name == other.name && timestamp == other.timestamp;
  }

  @override
  int get hashCode => Object.hash(name, timestamp);

  factory Checkpoint.fromJson(Map<String, dynamic> json) =>
      _$CheckpointFromJson(json);

  @override
  Map<String, dynamic> toJson() => _$CheckpointToJson(this);
}