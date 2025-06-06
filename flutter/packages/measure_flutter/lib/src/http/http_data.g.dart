// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'http_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HttpData _$HttpDataFromJson(Map<String, dynamic> json) => HttpData(
      url: json['url'] as String,
      method: json['method'] as String,
      client: json['client'] as String,
      statusCode: (json['status_code'] as num?)?.toInt(),
      startTime: (json['start_time'] as num?)?.toInt(),
      endTime: (json['end_time'] as num?)?.toInt(),
      failureReason: json['failure_reason'] as String?,
      failureDescription: json['failure_description'] as String?,
      requestHeaders: (json['request_headers'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(k, e as String),
      ),
      responseHeaders: (json['response_headers'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(k, e as String),
      ),
      requestBody: json['request_body'] as String?,
      responseBody: json['response_body'] as String?,
    );

Map<String, dynamic> _$HttpDataToJson(HttpData instance) => <String, dynamic>{
      'url': instance.url,
      'method': instance.method,
      'status_code': instance.statusCode,
      'start_time': instance.startTime,
      'end_time': instance.endTime,
      'failure_reason': instance.failureReason,
      'failure_description': instance.failureDescription,
      'request_headers': instance.requestHeaders,
      'response_headers': instance.responseHeaders,
      'request_body': instance.requestBody,
      'response_body': instance.responseBody,
      'client': instance.client,
    };
