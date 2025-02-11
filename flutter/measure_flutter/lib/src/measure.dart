abstract class IMeasure {
  Future<void> init({
    bool enableLogging = false,
  });

  void trackEvent({
    required String name,
    DateTime? timestamp,
    Map<String, dynamic> attributes = const {},
  });
}
