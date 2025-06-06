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
}
