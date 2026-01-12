import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/config/dynamic_config.dart';
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';

class FakeConfigProvider implements ConfigProvider {
  List<String> _defaultHttpContentTypeAllowlist = [];
  List<String> _defaultHttpHeadersBlocklist = [];
  bool _enableLogging = false;
  int _maxCheckpointNameLength = 64;
  int _maxCheckpointsPerSpan = 100;
  int _maxSpanNameLength = 64;
  bool _autoStart = true;
  int _maxAttachmentsInBugReport = 5;
  int _maxDescriptionLengthInBugReport = 1000;
  int _screenshotCompressionQuality = 20;
  int _maxEventNameLength = 64;
  String _customEventNameRegex = '^[a-zA-Z0-9_-]+\$';
  int _maxUserDefinedAttributeValueLength = 100;
  int _maxUserDefinedAttributeKeyLength = 256;
  int _maxUserDefinedAttributesPerEvent = 256;
  double _traceSamplingRate = 100;
  bool _crashTakeScreenshot = true;
  bool _gestureClickTakeSnapshot = true;
  ScreenshotMaskLevel _screenshotMaskLevel = ScreenshotMaskLevel.none;
  final List<String> _httpDisableEventForUrls = [];
  final List<String> _httpTrackRequestForUrls = [];
  final List<String> _httpTrackResponseForUrls = [];
  List<String> _httpBlockedHeaders = [];
  bool shouldTrackHttpEventResult = true;
  Map<String, bool> shouldTrackHttpHeaderResults = {};
  bool shouldTrackHttpRequestBodyResult = true;
  bool shouldTrackHttpResponseBodyResult = true;

  // Getters
  @override
  List<String> get defaultHttpContentTypeAllowlist =>
      _defaultHttpContentTypeAllowlist;

  @override
  List<String> get defaultHttpHeadersBlocklist => _defaultHttpHeadersBlocklist;

  @override
  bool get enableLogging => _enableLogging;

  @override
  int get maxCheckpointNameLength => _maxCheckpointNameLength;

  @override
  int get maxCheckpointsPerSpan => _maxCheckpointsPerSpan;

  @override
  int get maxSpanNameLength => _maxSpanNameLength;

  @override
  int get maxAttachmentsInBugReport => _maxAttachmentsInBugReport;

  @override
  int get maxDescriptionLengthInBugReport => _maxDescriptionLengthInBugReport;

  @override
  int get screenshotCompressionQuality => _screenshotCompressionQuality;

  @override
  int get maxEventNameLength => _maxEventNameLength;

  @override
  String get customEventNameRegex => _customEventNameRegex;

  @override
  int get maxUserDefinedAttributeValueLength => _maxUserDefinedAttributeValueLength;

  @override
  int get maxUserDefinedAttributeKeyLength => _maxUserDefinedAttributeKeyLength;

  @override
  int get maxUserDefinedAttributesPerEvent => _maxUserDefinedAttributesPerEvent;

  @override
  bool get crashTakeScreenshot => _crashTakeScreenshot;

  @override
  bool get gestureClickTakeSnapshot => _gestureClickTakeSnapshot;

  @override
  List<String> get httpBlockedHeaders => _httpBlockedHeaders;

  @override
  List<String> get httpDisableEventForUrls => _httpDisableEventForUrls;

  @override
  List<String> get httpTrackRequestForUrls => _httpTrackRequestForUrls;

  @override
  List<String> get httpTrackResponseForUrls => _httpTrackResponseForUrls;

  @override
  ScreenshotMaskLevel get screenshotMaskLevel => _screenshotMaskLevel;

  @override
  double get traceSamplingRate => _traceSamplingRate;

  @override
  void setDynamicConfig(DynamicConfig dynamicConfig) {
    throw UnimplementedError();
  }

  @override
  void setMeasureUrl(String url) {
    throw UnimplementedError();
  }

  @override
  bool shouldTrackHttpEvent(String url) {
    return shouldTrackHttpEventResult;
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    return shouldTrackHttpHeaderResults[key] ?? true;
  }

  @override
  bool shouldTrackHttpRequestBody(String url) {
    return shouldTrackHttpRequestBodyResult;
  }

  @override
  bool shouldTrackHttpResponseBody(String url) {
    return shouldTrackHttpResponseBodyResult;
  }

  // Setters
  set defaultHttpContentTypeAllowlist(List<String> value) =>
      _defaultHttpContentTypeAllowlist = value;

  set defaultHttpHeadersBlocklist(List<String> value) =>
      _defaultHttpHeadersBlocklist = value;

  set enableLogging(bool value) => _enableLogging = value;

  @override
  bool get autoStart => _autoStart;

  set maxCheckpointNameLength(int value) => _maxCheckpointNameLength = value;

  set maxCheckpointsPerSpan(int value) => _maxCheckpointsPerSpan = value;

  set maxSpanNameLength(int value) => _maxSpanNameLength = value;

  set autoStart(bool value) => _autoStart = value;

  set maxAttachmentsInBugReport(int value) =>
      _maxAttachmentsInBugReport = value;

  set maxDescriptionLengthInBugReport(int value) =>
      _maxDescriptionLengthInBugReport = value;

  set screenshotCompressionQuality(int value) =>
      _screenshotCompressionQuality = value;

  set customEventNameRegex(String value) => _customEventNameRegex = value;

  set maxEventNameLength(int value) => _maxEventNameLength = value;

  set maxUserDefinedAttributeValueLength(int value) => _maxUserDefinedAttributeValueLength = value;

  set maxUserDefinedAttributeKeyLength(int value) => _maxUserDefinedAttributeKeyLength = value;

  set maxUserDefinedAttributesPerEvent(int value) => _maxUserDefinedAttributesPerEvent = value;

  set crashTakeScreenshot(bool value) => _crashTakeScreenshot = value;

  set gestureClickTakeSnapshot(bool value) => _gestureClickTakeSnapshot = value;

  set traceSamplingRate(double value) => _traceSamplingRate = value;

  set screenshotMaskLevel(ScreenshotMaskLevel value) => _screenshotMaskLevel = value;

  set httpBlockedHeaders(List<String> value) => _httpBlockedHeaders = value;
}
