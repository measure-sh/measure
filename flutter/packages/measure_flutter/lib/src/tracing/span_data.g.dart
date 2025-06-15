// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'span_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SpanData _$SpanDataFromJson(Map<String, dynamic> json) => SpanData(
      name: json['name'] as String,
      traceId: json['traceId'] as String,
      spanId: json['spanId'] as String,
      parentId: json['parentId'] as String?,
      sessionId: json['sessionId'] as String,
      startTime: (json['startTime'] as num).toInt(),
      endTime: (json['endTime'] as num).toInt(),
      duration: (json['duration'] as num).toInt(),
      status: $enumDecode(_$SpanStatusEnumMap, json['status']),
      attributes: json['attributes'] as Map<String, dynamic>,
      userDefinedAttrs: json['userDefinedAttrs'] as Map<String, dynamic>,
      checkpoints: (json['checkpoints'] as List<dynamic>)
          .map((e) => Checkpoint.fromJson(e as Map<String, dynamic>))
          .toList(),
      hasEnded: json['hasEnded'] as bool,
      isSampled: json['isSampled'] as bool,
    );

Map<String, dynamic> _$SpanDataToJson(SpanData instance) => <String, dynamic>{
      'name': instance.name,
      'traceId': instance.traceId,
      'spanId': instance.spanId,
      'parentId': instance.parentId,
      'sessionId': instance.sessionId,
      'startTime': instance.startTime,
      'endTime': instance.endTime,
      'duration': instance.duration,
      'status': _$SpanStatusEnumMap[instance.status]!,
      'attributes': instance.attributes,
      'userDefinedAttrs': instance.userDefinedAttrs,
      'checkpoints': instance.checkpoints,
      'hasEnded': instance.hasEnded,
      'isSampled': instance.isSampled,
    };

const _$SpanStatusEnumMap = {
  SpanStatus.unset: 0,
  SpanStatus.ok: 1,
  SpanStatus.error: 2,
};
