import 'package:measure_flutter/measure.dart';

class HttpCall {
  final String url;
  final HttpMethod method;
  final int? statusCode;
  final int? startTime;
  final int? endTime;
  final String? failureReason;
  final String? failureDescription;
  final Map<String, String>? requestHeaders;
  final Map<String, String>? responseHeaders;
  final String? requestBody;
  final String? responseBody;
  final String? client;

  HttpCall(
    this.url,
    this.method,
    this.statusCode,
    this.startTime,
    this.endTime,
    this.failureReason,
    this.failureDescription,
    this.requestHeaders,
    this.responseHeaders,
    this.requestBody,
    this.responseBody,
    this.client,
  );
}
