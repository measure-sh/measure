import 'dart:async';

abstract class MeasureApi {
  Future<void> start(
    FutureOr<void> Function() action, {
    bool enableLogging = false,
  });

  void trackEvent({
    required String name,
    required DateTime? timestamp,
  });

  void trackHandledError(Object error, StackTrace stack);

  void triggerNativeCrash();

  void trackScreenViewEvent({
    required String name,
    bool userTriggered = true,
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
}
