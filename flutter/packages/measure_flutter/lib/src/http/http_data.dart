import 'package:json_annotation/json_annotation.dart';

import '../serialization/json_serializable.dart';

part 'http_data.g.dart';

@JsonSerializable()
class HttpData implements JsonSerialized {
  /// The complete URL of the request.
  final String url;

  /// HTTP method, like get, post, put, etc. In lowercase.
  final String method;

  /// HTTP response code. Example: 200, 401, 500, etc.
  @JsonKey(name: "status_code")
  final int? statusCode;

  /// The uptime at which the http call started, in milliseconds.
  @JsonKey(name: "start_time")
  final int? startTime;

  /// The uptime at which the http call ended, in milliseconds.
  @JsonKey(name: "end_time")
  final int? endTime;

  /// The reason for the failure. Typically the IOException class name.
  @JsonKey(name: "failure_reason")
  final String? failureReason;

  /// The description of the failure. Typically the IOException message.
  @JsonKey(name: "failure_description")
  final String? failureDescription;

  /// The request headers.
  @JsonKey(name: "request_headers")
  final Map<String, String>? requestHeaders;

  /// The response headers.
  @JsonKey(name: "response_headers")
  final Map<String, String>? responseHeaders;

  /// The request body.
  @JsonKey(name: "request_body")
  final String? requestBody;

  /// The response body.
  @JsonKey(name: "response_body")
  final String? responseBody;

  /// The name of the client that sent the request.
  final String client;

  HttpData({
    required this.url,
    required this.method,
    required this.client,
    this.statusCode,
    this.startTime,
    this.endTime,
    this.failureReason,
    this.failureDescription,
    this.requestHeaders,
    this.responseHeaders,
    this.requestBody,
    this.responseBody,
  });

  @override
  Map<String, dynamic> toJson() => _$HttpDataToJson(this);

  factory HttpData.fromJson(Map<String, dynamic> json) =>
      _$HttpDataFromJson(json);
}
