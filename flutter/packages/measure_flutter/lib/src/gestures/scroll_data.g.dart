// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'scroll_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ScrollData _$ScrollDataFromJson(Map<String, dynamic> json) => ScrollData(
      target: json['target'] as String,
      targetId: json['target_id'] as String?,
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
      endX: (json['end_x'] as num).toDouble(),
      endY: (json['end_y'] as num).toDouble(),
      touchDownTime: (json['touch_down_time'] as num?)?.toInt(),
      touchUpTime: (json['touch_up_time'] as num?)?.toInt(),
      direction: $enumDecode(_$MsrScrollDirectionEnumMap, json['direction']),
    );

Map<String, dynamic> _$ScrollDataToJson(ScrollData instance) =>
    <String, dynamic>{
      'target': instance.target,
      'target_id': instance.targetId,
      'x': instance.x,
      'y': instance.y,
      'end_x': instance.endX,
      'end_y': instance.endY,
      'touch_down_time': instance.touchDownTime,
      'touch_up_time': instance.touchUpTime,
      'direction': _$MsrScrollDirectionEnumMap[instance.direction]!,
    };

const _$MsrScrollDirectionEnumMap = {
  MsrScrollDirection.left: 'left',
  MsrScrollDirection.up: 'up',
  MsrScrollDirection.right: 'right',
  MsrScrollDirection.down: 'down',
};
