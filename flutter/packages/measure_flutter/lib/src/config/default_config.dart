class DefaultConfig {
  static const bool enableLogging = false;
  static const bool trackScreenshotOnCrash = false;
  static const bool autoInitializeNativeSDK = true;
  static const bool autoStart = true;
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
  static const int maxCheckpointsPerSpan = 100;
  static const int maxSpanNameLength = 64;
  static const int maxCheckpointNameLength = 64;
  static const int maxAttachmentsInBugReport = 5;
  static const int maxDescriptionLengthInBugReport = 1000;
  static const int screenshotCompressionQuality = 20;
}