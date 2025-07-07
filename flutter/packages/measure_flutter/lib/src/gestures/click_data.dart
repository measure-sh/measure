import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';

part 'click_data.g.dart';

@JsonSerializable()
class ClickData implements JsonSerialized {
  final String target;
  @JsonKey(name: "target_id")
  final String? targetId;
  final double x;
  final double y;
  @JsonKey(name: "touch_down_time")
  final int? touchDownTime;
  @JsonKey(name: "touch_up_time")
  final int? touchUpTime;
  final int? width;
  final int? height;

  ClickData({
    required this.target,
    this.targetId,
    required this.x,
    required this.y,
    required this.touchDownTime,
    required this.touchUpTime,
    this.width,
    this.height
  });

  @override
  Map<String, dynamic> toJson() => _$ClickDataToJson(this);

  static ClickData fromJson(Map<String, dynamic> json) =>
      _$ClickDataFromJson(json);
}
