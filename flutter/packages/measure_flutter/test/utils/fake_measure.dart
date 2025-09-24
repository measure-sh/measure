import 'dart:async';

import 'package:flutter/src/widgets/framework.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';

class FakeMeasure implements MeasureApi {
  final List<ScreenViewCall> trackedScreenViews = [];
  final List<BugReportCall> trackedBugReports = [];

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
    int? timestamp,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<void> trackHandledError(
    Object error,
    StackTrace stack, {
    Map<String, AttributeValue> attributes = const {},
  }) async {
    throw UnimplementedError();
  }

  @override
  void triggerNativeCrash() {
    throw UnimplementedError();
  }

  @override
  void trackScreenViewEvent({required String name, bool userTriggered = true}) {
    trackedScreenViews.add(ScreenViewCall(name, userTriggered));
  }

  void clear() {
    trackedScreenViews.clear();
    trackedBugReports.clear();
  }

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
    throw UnimplementedError();
  }

  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    throw UnimplementedError();
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    throw UnimplementedError();
  }

  @override
  bool shouldTrackHttpUrl(String url) {
    throw UnimplementedError();
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
  int getCurrentTime() {
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
  void trackBugReport({
    required String description,
    required List<MsrAttachment> attachments,
    required Map<String, AttributeValue> attributes,
  }) {
    trackedBugReports.add(BugReportCall(description, attachments, attributes));
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
  void trackClick(ClickData clickData) {
    throw UnimplementedError();
  }

  @override
  void trackLongClick(LongClickData longClickData) {
    throw UnimplementedError();
  }

  @override
  void trackScroll(ScrollData scrollData) {
    throw UnimplementedError();
  }
}

class ScreenViewCall {
  final String name;
  final bool userTriggered;

  ScreenViewCall(this.name, this.userTriggered);
}

class BugReportCall {
  final String description;
  final List<MsrAttachment> attachments;
  final Map<String, AttributeValue> attributes;

  BugReportCall(this.description, this.attachments, this.attributes);
}
