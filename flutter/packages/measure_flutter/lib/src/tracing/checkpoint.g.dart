// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'checkpoint.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Checkpoint _$CheckpointFromJson(Map<String, dynamic> json) => Checkpoint(
      json['name'] as String,
      (json['timestamp'] as num).toInt(),
    );

Map<String, dynamic> _$CheckpointToJson(Checkpoint instance) =>
    <String, dynamic>{
      'name': instance.name,
      'timestamp': instance.timestamp,
    };
