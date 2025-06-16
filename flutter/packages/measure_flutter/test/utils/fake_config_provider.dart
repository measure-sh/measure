import 'package:measure_flutter/src/config/config_provider.dart';

class FakeConfigProvider implements ConfigProvider {
  bool _autoInitializeNativeSDK = false;
  List<String> _defaultHttpContentTypeAllowlist = [];
  List<String> _defaultHttpHeadersBlocklist = [];
  bool _enableLogging = false;
  List<String> _httpHeadersBlocklist = [];
  List<String> _httpUrlAllowlist = [];
  List<String> _httpUrlBlocklist = [];
  int _maxCheckpointNameLength = 64;
  int _maxCheckpointsPerSpan = 100;
  int _maxSpanNameLength = 64;
  double _samplingRateForErrorFreeSessions = 0.0;
  double _traceSamplingRate = 0.0;
  bool _trackActivityIntentData = false;
  bool _trackActivityLoadTime = false;
  bool _trackFragmentLoadTime = false;
  bool _trackHttpBody = false;
  bool _trackHttpHeaders = false;
  bool _trackViewControllerLoadTime = false;
  bool _autoStart = true;

  // Getters
  @override
  bool get autoInitializeNativeSDK => _autoInitializeNativeSDK;

  @override
  List<String> get defaultHttpContentTypeAllowlist => _defaultHttpContentTypeAllowlist;

  @override
  List<String> get defaultHttpHeadersBlocklist => _defaultHttpHeadersBlocklist;

  @override
  bool get enableLogging => _enableLogging;

  @override
  List<String> get httpHeadersBlocklist => _httpHeadersBlocklist;

  @override
  List<String> get httpUrlAllowlist => _httpUrlAllowlist;

  @override
  List<String> get httpUrlBlocklist => _httpUrlBlocklist;

  @override
  int get maxCheckpointNameLength => _maxCheckpointNameLength;

  @override
  int get maxCheckpointsPerSpan => _maxCheckpointsPerSpan;

  @override
  int get maxSpanNameLength => _maxSpanNameLength;

  @override
  double get samplingRateForErrorFreeSessions => _samplingRateForErrorFreeSessions;

  @override
  double get traceSamplingRate => _traceSamplingRate;

  @override
  bool get trackActivityIntentData => _trackActivityIntentData;

  @override
  bool get trackActivityLoadTime => _trackActivityLoadTime;

  @override
  bool get trackFragmentLoadTime => _trackFragmentLoadTime;

  @override
  bool get trackHttpBody => _trackHttpBody;

  @override
  bool get trackHttpHeaders => _trackHttpHeaders;

  @override
  bool get trackViewControllerLoadTime => _trackViewControllerLoadTime;

  // Setters
  set autoInitializeNativeSDK(bool value) => _autoInitializeNativeSDK = value;

  set defaultHttpContentTypeAllowlist(List<String> value) =>
      _defaultHttpContentTypeAllowlist = value;

  set defaultHttpHeadersBlocklist(List<String> value) =>
      _defaultHttpHeadersBlocklist = value;

  set enableLogging(bool value) => _enableLogging = value;

  set httpHeadersBlocklist(List<String> value) => _httpHeadersBlocklist = value;

  set httpUrlAllowlist(List<String> value) => _httpUrlAllowlist = value;

  @override
  bool get autoStart => _autoStart;

  set httpUrlBlocklist(List<String> value) => _httpUrlBlocklist = value;

  set maxCheckpointNameLength(int value) => _maxCheckpointNameLength = value;

  set maxCheckpointsPerSpan(int value) => _maxCheckpointsPerSpan = value;

  set maxSpanNameLength(int value) => _maxSpanNameLength = value;

  set samplingRateForErrorFreeSessions(double value) =>
      _samplingRateForErrorFreeSessions = value;

  set traceSamplingRate(double value) => _traceSamplingRate = value;

  set trackActivityIntentData(bool value) => _trackActivityIntentData = value;

  set trackActivityLoadTime(bool value) => _trackActivityLoadTime = value;

  set trackFragmentLoadTime(bool value) => _trackFragmentLoadTime = value;

  set trackHttpBody(bool value) => _trackHttpBody = value;

  set trackHttpHeaders(bool value) => _trackHttpHeaders = value;

  set trackViewControllerLoadTime(bool value) => _trackViewControllerLoadTime = value;

  set autoStart(bool value) => _autoStart = value;

  // Methods
  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    return _trackHttpBody;
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    return _trackHttpHeaders && !_httpHeadersBlocklist.contains(key.toLowerCase());
  }

  @override
  bool shouldTrackHttpUrl(String url) {
    // If allowlist is empty, allow all URLs not in blocklist
    if (_httpUrlAllowlist.isEmpty) {
      return !_httpUrlBlocklist.any((blocked) => url.contains(blocked));
    }

    // If allowlist is not empty, only allow URLs in allowlist
    return _httpUrlAllowlist.any((allowed) => url.contains(allowed)) &&
        !_httpUrlBlocklist.any((blocked) => url.contains(blocked));
  }
}