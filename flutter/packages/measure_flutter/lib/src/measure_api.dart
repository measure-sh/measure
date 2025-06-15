import 'dart:async';

import 'package:measure_flutter/src/config/client.dart';
import 'package:measure_flutter/src/config/measure_config.dart';

import '../measure.dart';

abstract class MeasureApi {
  void trackEvent({
    required String name,
    required DateTime? timestamp,
  });

  Future<void> start(
    FutureOr<void> Function() action, {
    required ClientInfo clientInfo,
    MeasureConfig config = const MeasureConfig(),
  });

  void trackHandledError(Object error, StackTrace stack);

  void triggerNativeCrash();

  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
  });

  bool shouldTrackHttpBody(String url, String? contentType);

  bool shouldTrackHttpUrl(String url);

  bool shouldTrackHttpHeader(String key);

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
}
