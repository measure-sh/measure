import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';

import 'gestures/long_click_data.dart';

abstract class MeasureApi {
  void trackEvent({
    required String name,
    Map<String, AttributeValue> attributes = const {},
    int? timestamp,
  });

  Future<void> init(
    FutureOr<void> Function() action, {
    MeasureConfig config = const MeasureConfig(),
  });

  Future<void> start();

  Future<void> stop();

  void trackHandledError(
    Object error,
    StackTrace stack, {
    Map<String, AttributeValue> attributes,
  });

  void triggerNativeCrash();

  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
  });

  bool shouldTrackHttpRequestBody(String url);

  bool shouldTrackHttpResponseBody(String url);

  bool shouldTrackHttpEvent(String url);

  bool shouldTrackHttpHeader(String key);

  void trackBugReport({
    required String description,
    required List<MsrAttachment> attachments,
    required Map<String, AttributeValue> attributes,
  });

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
  });

  Span startSpan(
    String name, {
    int? timestamp,
  });

  SpanBuilder? createSpanBuilder(String name);

  String getTraceParentHeaderValue(Span span);

  String getTraceParentHeaderKey();

  int getCurrentTime();

  Future<void> setUserId(String userId);

  Future<void> clearUserId();

  Future<String?> getSessionId();

  Future<MsrAttachment?> captureScreenshot();

  Widget createBugReportWidget({
    Key? key,
    BugReportTheme theme,
    required MsrAttachment? screenshot,
    required Map<String, AttributeValue>? attributes,
  });

  void setShakeListener(Function? onShake);

  void trackClick(ClickData clickData);

  void trackLongClick(LongClickData longClickData);

  void trackScroll(ScrollData scrollData);
}
