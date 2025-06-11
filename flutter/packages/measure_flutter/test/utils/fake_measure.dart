import 'dart:async';

import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/measure.dart';

class FakeMeasure implements MeasureApi {
  final List<ScreenViewCall> trackedScreenViews = [];

  @override
  Future<void> start(
    FutureOr<void> Function() action, {
    required ClientInfo clientInfo,
    MeasureConfig config = const MeasureConfig(),
  }) async {
    await action();
  }

  @override
  void trackEvent(
      {required String name,
      Map<String, AttributeValue> attributes = const {},
      DateTime? timestamp}) {}

  @override
  Future<void> trackHandledError(Object error, StackTrace stack) async {}

  @override
  void triggerNativeCrash() {}

  @override
  void trackScreenViewEvent({required String name, bool userTriggered = true}) {
    trackedScreenViews.add(ScreenViewCall(name, userTriggered));
  }

  void clear() {
    trackedScreenViews.clear();
  }

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
}

class ScreenViewCall {
  final String name;
  final bool userTriggered;

  ScreenViewCall(this.name, this.userTriggered);
}
