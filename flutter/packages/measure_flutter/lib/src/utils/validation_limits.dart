/// Field limits enforced by the backend.
final class ValidationLimits {
  ValidationLimits._();

  static const int userId = 128;
  static const int screenViewName = 1024;
  static const int httpClient = 32;
}
