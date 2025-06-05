// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'http_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HttpData _$HttpDataFromJson(Map<String, dynamic> json) => HttpData(
      url: json['url'] as String,
      method: json['method'] as String,
      client: json['client'] as String,
      statusCode: (json['statusCode'] as num?)?.toInt(),
      startTime: (json['startTime'] as num?)?.toInt(),
      endTime: (json['endTime'] as num?)?.toInt(),
      failureReason: json['failureReason'] as String?,
      failureDescription: json['failureDescription'] as String?,
      requestHeaders: (json['requestHeaders'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(k, e as String),
      ),
      responseHeaders: (json['responseHeaders'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(k, e as String),
      ),
      requestBody: json['requestBody'] as String?,
      responseBody: json['responseBody'] as String?,
    );

Map<String, dynamic> _$HttpDataToJson(HttpData instance) => <String, dynamic>{
      'url': instance.url,
      'method': instance.method,
      'statusCode': instance.statusCode,
      'startTime': instance.startTime,
      'endTime': instance.endTime,
      'failureReason': instance.failureReason,
      'failureDescription': instance.failureDescription,
      'requestHeaders': instance.requestHeaders,
      'responseHeaders': instance.responseHeaders,
      'requestBody': instance.requestBody,
      'responseBody': instance.responseBody,
      'client': instance.client,
    };
