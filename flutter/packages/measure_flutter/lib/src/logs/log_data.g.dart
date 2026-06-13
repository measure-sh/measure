// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'log_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LogData _$LogDataFromJson(Map<String, dynamic> json) => LogData(
      severityText: json['severity_text'] as String,
      severityNumber: (json['severity_number'] as num).toInt(),
      body: json['body'] as String,
    );

Map<String, dynamic> _$LogDataToJson(LogData instance) => <String, dynamic>{
      'severity_text': instance.severityText,
      'severity_number': instance.severityNumber,
      'body': instance.body,
    };
