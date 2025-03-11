abstract class IMeasure {
  Future<void> init({
    bool enableLogging = false,
  });

  void trackEvent({
    required String name,
    required DateTime? timestamp,
  });

  Future<void> trackFlutterError(Object error, StackTrace? stack);

  void triggerNativeCrash();
}
