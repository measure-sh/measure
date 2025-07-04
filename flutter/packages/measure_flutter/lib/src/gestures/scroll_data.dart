import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/src/gestures/scroll_direction.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';

part 'scroll_data.g.dart';

@JsonSerializable()
class ScrollData implements JsonSerialized {
  final String target;
  @JsonKey(name: "target_id")
  final String? targetId;
  final double x;
  final double y;
  @JsonKey(name: "end_x")
  final double endX;
  @JsonKey(name: "end_y")
  final double endY;
  @JsonKey(name: "touch_down_time")
  final int? touchDownTime;
  @JsonKey(name: "touch_up_time")
  final int? touchUpTime;
  final MsrScrollDirection direction;

  ScrollData({
    required this.target,
    this.targetId,
    required this.x,
    required this.y,
    required this.endX,
    required this.endY,
    required this.touchDownTime,
    required this.touchUpTime,
    required this.direction,
  });

  @override
  Map<String, dynamic> toJson() => _$ScrollDataToJson(this);

  static ScrollData fromJson(Map<String, dynamic> json) =>
      _$ScrollDataFromJson(json);
}
