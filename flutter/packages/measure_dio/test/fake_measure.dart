import 'dart:async';

import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/measure_api.dart';

class FakeMeasure implements MeasureApi {
  final List<HttpCall> trackedHttp = [];

  @override
  Future<void> start(
    FutureOr<void> Function() action, {
    bool enableLogging = false,
  }) async {
    await action();
  }

  @override
  void trackEvent({
    required String name,
    Map<String, AttributeValue> attributes = const {},
    DateTime? timestamp,
  }) {}

  @override
  Future<void> trackHandledError(Object error, StackTrace stack) async {}

  @override
  void triggerNativeCrash() {}

  @override
  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
  }) {}

  @override
  void trackHttpEvent({
    required String url,
    required String method,
    int? statusCode,
    int? startTime,
    int? endTime,
    String? failureReason,
    String? failureDescription,
    Map<String, String>? requestHeaders,
    Map<String, String>? responseHeaders,
    String? requestBody,
    String? responseBody,
    String? client,
  }) {
    trackedHttp.add(
      HttpCall(
        url,
        method,
        statusCode,
        startTime,
        endTime,
        failureReason,
        failureDescription,
        requestHeaders,
        responseHeaders,
        requestBody,
        responseBody,
        client,
      ),
    );
  }

  void clear() {
    trackedHttp.clear();
  }
}

class HttpCall {
  final String url;
  final String method;
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
