// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'click_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClickData _$ClickDataFromJson(Map<String, dynamic> json) => ClickData(
      target: json['target'] as String,
      targetId: json['target_id'] as String?,
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
      touchDownTime: (json['touch_down_time'] as num?)?.toInt(),
      touchUpTime: (json['touch_up_time'] as num?)?.toInt(),
      width: (json['width'] as num?)?.toInt(),
      height: (json['height'] as num?)?.toInt(),
    );

Map<String, dynamic> _$ClickDataToJson(ClickData instance) => <String, dynamic>{
      'target': instance.target,
      'target_id': instance.targetId,
      'x': instance.x,
      'y': instance.y,
      'touch_down_time': instance.touchDownTime,
      'touch_up_time': instance.touchUpTime,
      'width': instance.width,
      'height': instance.height,
    };
