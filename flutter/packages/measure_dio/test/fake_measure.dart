import 'dart:async';

import 'package:flutter/material.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';

import 'http_call.dart';

class FakeMeasure implements MeasureApi {
  final List<HttpCall> trackedHttp = [];
  var _shouldTrackHttpRequestBody = false;
  var _shouldTrackHttpResponseBody = false;
  var _shouldTrackHttpUrl = false;
  var _shouldTrackHttpHeader = false;

  @override
  Future<void> init(
    FutureOr<void> Function() action, {
    MeasureConfig config = const MeasureConfig(),
  }) async {
    await action();
  }

  @override
  void trackEvent({
    required String name,
    Map<String, AttributeValue> attributes = const {},
    int? timestamp,
  }) {}

  @override
  Future<void> trackHandledError(
    Object error,
    StackTrace stack, {
    Map<String, AttributeValue> attributes = const {},
  }) async {
    throw UnimplementedError();
  }

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
    required HttpMethod method,
    required int startTime,
    required int endTime,
    int? statusCode,
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

  void setShouldTrackHttpRequestBody(bool value) => _shouldTrackHttpRequestBody = value;

  void setShouldTrackHttpResponseBody(bool value) => _shouldTrackHttpResponseBody = value;

  void setShouldTrackHttpHeader(bool value) => _shouldTrackHttpHeader = value;

  void setShouldTrackHttpUrl(bool value) => _shouldTrackHttpUrl = value;

  @override
  bool shouldTrackHttpHeader(String key) {
    return _shouldTrackHttpHeader;
  }

  @override
  bool shouldTrackHttpRequestBody(String url) {
    return _shouldTrackHttpRequestBody;
  }

  @override
  bool shouldTrackHttpResponseBody(String url) {
    return _shouldTrackHttpResponseBody;
  }

  @override
  bool shouldTrackHttpEvent(String url) {
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

  @override
  Future<String?> getSessionId() {
    throw UnimplementedError();
  }

  @override
  Future<MsrAttachment?> captureScreenshot() {
    throw UnimplementedError();
  }

  @override
  Future<void> trackBugReport({
    required String description,
    required List<MsrAttachment> attachments,
    required Map<String, AttributeValue> attributes,
  }) async {
    throw UnimplementedError();
  }

  @override
  Widget createBugReportWidget({
    Key? key,
    BugReportTheme theme = const BugReportTheme(),
    required MsrAttachment? screenshot,
    required Map<String, AttributeValue>? attributes,
  }) {
    throw UnimplementedError();
  }

  @override
  void setShakeListener(Function? onShake) {
    throw UnimplementedError();
  }

  @override
  Future<void> trackClick(ClickData clickData, SnapshotNode? snapshot) async {
    throw UnimplementedError();
  }

  @override
  Future<void> trackLongClick(
      LongClickData longClickData, SnapshotNode? snapshot) async {
    throw UnimplementedError();
  }

  @override
  Future<void> trackScroll(ScrollData scrollData) async {
    throw UnimplementedError();
  }

  @override
  Map<Type, String> getLayoutSnapshotWidgetFilter() {
    throw UnimplementedError();
  }
}
