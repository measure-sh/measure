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

  /// The number of bytes sent in the request body.
  @JsonKey(name: "bytes_sent")
  final int? bytesSent;

  /// The number of bytes received in the response body.
  @JsonKey(name: "bytes_received")
  final int? bytesReceived;

  /// The time taken for DNS resolution, in milliseconds.
  @JsonKey(name: "dns_duration")
  final int? dnsDuration;

  /// The time taken for TLS handshake, in milliseconds.
  @JsonKey(name: "tls_duration")
  final int? tlsDuration;

  /// The time taken to send the request, in milliseconds.
  @JsonKey(name: "request_send_duration")
  final int? requestSendDuration;

  /// The time taken to read the response, in milliseconds.
  @JsonKey(name: "response_read_duration")
  final int? responseReadDuration;

  /// Whether the request failed before receiving a response from the server.
  @JsonKey(name: "is_client_error")
  final bool? isClientError;

  /// Whether the request failed due to a timeout.
  @JsonKey(name: "is_timeout")
  final bool? isTimeout;

  HttpData({
    required this.url,
    required this.method,
    required this.client,
    required this.startTime,
    this.statusCode,
    this.endTime,
    this.failureReason,
    this.failureDescription,
    this.requestHeaders,
    this.responseHeaders,
    this.requestBody,
    this.responseBody,
    this.bytesSent,
    this.bytesReceived,
    this.dnsDuration,
    this.tlsDuration,
    this.requestSendDuration,
    this.responseReadDuration,
    this.isClientError,
    this.isTimeout,
  });

  @override
  Map<String, dynamic> toJson() => _$HttpDataToJson(this);

  factory HttpData.fromJson(Map<String, dynamic> json) =>
      _$HttpDataFromJson(json);
}
