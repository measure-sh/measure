import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:measure_flutter/measure.dart';

abstract class MeasureApi {
  void trackEvent({
    required String name,
    required DateTime? timestamp,
  });

  Future<void> init(
    FutureOr<void> Function() action, {
    required ClientInfo clientInfo,
    MeasureConfig config = const MeasureConfig(),
  });

  Future<void> start();

  Future<void> stop();

  void trackHandledError(Object error, StackTrace stack);

  void triggerNativeCrash();

  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
  });

  bool shouldTrackHttpBody(String url, String? contentType);

  bool shouldTrackHttpUrl(String url);

  bool shouldTrackHttpHeader(String key);

  void trackBugReport({
    required String description,
    required List<MsrAttachment> attachments,
    required Map<String, AttributeValue> attributes,
  });

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
}
