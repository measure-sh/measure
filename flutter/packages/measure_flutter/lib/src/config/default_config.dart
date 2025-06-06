class DefaultConfig {
  static const bool enableLogging = false;
  static const bool trackHttpHeaders = false;
  static const bool trackHttpBody = false;
  static const List<String> httpHeadersBlocklist = <String>[];
  static const List<String> httpUrlBlocklist = <String>[];
  static const List<String> httpUrlAllowlist = <String>[];
}
