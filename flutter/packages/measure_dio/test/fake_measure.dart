import 'dart:async';

import 'package:measure_flutter/measure.dart';

import 'http_call.dart';

class FakeMeasure implements MeasureApi {
  final List<HttpCall> trackedHttp = [];
  var _shouldTrackHttpBody = false;
  var _shouldTrackHttpUrl = false;
  var _shouldTrackHttpHeader = false;

  @override
  Future<void> init(
    FutureOr<void> Function() action, {
    required ClientInfo clientInfo,
    MeasureConfig config = const MeasureConfig(),
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

  void clear() => trackedHttp.clear();

  void setShouldTrackHttpBody(bool value) => _shouldTrackHttpBody = value;

  void setShouldTrackHttpHeader(bool value) => _shouldTrackHttpHeader = value;

  void setShouldTrackHttpUrl(bool value) => _shouldTrackHttpUrl = value;

  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    return _shouldTrackHttpBody;
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    return _shouldTrackHttpHeader;
  }

  @override
  bool shouldTrackHttpUrl(String url) {
    return _shouldTrackHttpUrl;
  }

  @override
  Future<void> start() {
    throw UnimplementedError();
  }

  @override
  Future<void> stop() {
    throw UnimplementedError();
  }

  @override
  SpanBuilder? createSpanBuilder(String name) {
    throw UnimplementedError();
  }

  @override
  int getCurrentTime() {
    throw UnimplementedError();
  }

  @override
  String getTraceParentHeaderKey() {
    throw UnimplementedError();
  }

  @override
  String getTraceParentHeaderValue(Span span) {
    throw UnimplementedError();
  }

  @override
  Span startSpan(String name, {int? timestamp}) {
    throw UnimplementedError();
  }

  @override
  Future<void> clearUserId() {
    throw UnimplementedError();
  }

  @override
  Future<void> setUserId(String userId) {
    throw UnimplementedError();
  }
}
