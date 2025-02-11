abstract class IMeasure {
  Future<void> init({
    bool enableLogging = false,
  });

  void trackEvent({
    required String name,
    required DateTime? timestamp,
  });
}
