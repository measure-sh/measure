class DefaultConfig {
  static const bool enableLogging = false;
  static const bool autoInitializeNativeSDK = true;
  static const bool trackHttpHeaders = false;
  static const bool trackHttpBody = false;
  static const List<String> httpHeadersBlocklist = [];
  static const List<String> httpUrlBlocklist = [];
  static const List<String> httpUrlAllowlist = [];
  static const bool trackActivityIntentData = false;
  static const double sessionSamplingRate = 1.0;
  static const double traceSamplingRate = 0.1;
  static const bool trackActivityLoadTime = true;
  static const bool trackFragmentLoadTime = true;
  static const bool trackViewControllerLoadTime = true;
}