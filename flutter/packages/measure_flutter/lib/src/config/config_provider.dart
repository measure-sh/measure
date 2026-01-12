import 'package:measure_flutter/src/config/dynamic_config.dart';
import 'package:measure_flutter/src/config/screenshot_mask_level.dart';

import 'config.dart';
import 'internal_config.dart';
import 'measure_config.dart';

abstract class ConfigProvider implements IMeasureConfig, InternalConfig, IDynamicConfig {
  bool shouldTrackHttpEvent(String url);

  bool shouldTrackHttpRequestBody(String url);

  bool shouldTrackHttpResponseBody(String url);

  bool shouldTrackHttpHeader(String key);

  void setMeasureUrl(String url);

  void setDynamicConfig(DynamicConfig dynamicConfig);
}

/// Holds pre-compiled regex patterns for HTTP tracking configuration.
///
/// Patterns are compiled once when configuration changes to avoid
/// repeated compilation on every HTTP event.
class _HttpPatternState {
  _HttpPatternState({
    required this.disableEventPatterns,
    required this.trackRequestPatterns,
    required this.trackResponsePatterns,
    required this.blockedHeaders,
    this.measureUrl,
  });

  final List<RegExp> disableEventPatterns;
  final List<RegExp> trackRequestPatterns;
  final List<RegExp> trackResponsePatterns;
  final List<String> blockedHeaders;
  final String? measureUrl;

  _HttpPatternState copyWith({
    List<RegExp>? disableEventPatterns,
    List<RegExp>? trackRequestPatterns,
    List<RegExp>? trackResponsePatterns,
    List<String>? blockedHeaders,
    String? measureUrl,
  }) {
    return _HttpPatternState(
      disableEventPatterns: disableEventPatterns ?? this.disableEventPatterns,
      trackRequestPatterns: trackRequestPatterns ?? this.trackRequestPatterns,
      trackResponsePatterns: trackResponsePatterns ?? this.trackResponsePatterns,
      blockedHeaders: blockedHeaders ?? this.blockedHeaders,
      measureUrl: measureUrl ?? this.measureUrl,
    );
  }
}

/// Implementation of [ConfigProvider] that manages both static and dynamic configuration.
///
/// ## Configuration Types
///
/// **Static configuration** is provided at initialization via [Config] and remains constant
/// throughout the SDK's lifecycle. These values are accessed directly as properties.
///
/// **Dynamic configuration** is loaded asynchronously and updated via [ConfigProvider.setDynamicConfig].
///
/// ## HTTP Pattern Matching
///
/// URL patterns support `*` as a wildcard matching any sequence of characters. Patterns are
/// pre-compiled to [RegExp] objects when configuration is loaded to avoid repeated compilation
/// on every HTTP event. For example, `https://api.example.com/*` compiles to
/// `^https://api\.example\.com/.*$`.
///
/// The SDK's own endpoint URL is excluded from tracking via [setMeasureUrl] to prevent
/// recursive tracking of export requests.
class ConfigProviderImpl implements ConfigProvider {
  ConfigProviderImpl({
    required Config defaultConfig,
  }) : _defaultConfig = defaultConfig;

  final Config _defaultConfig;
  DynamicConfig _dynamicConfig = DynamicConfig.defaults();
  _HttpPatternState _httpPatternState = _HttpPatternState(
    disableEventPatterns: [],
    trackRequestPatterns: [],
    trackResponsePatterns: [],
    blockedHeaders: [],
    measureUrl: null,
  );

  @override
  bool get enableLogging => _defaultConfig.enableLogging;

  @override
  bool get autoStart => _defaultConfig.autoStart;

  @override
  List<String> get defaultHttpContentTypeAllowlist => _defaultConfig.defaultHttpContentTypeAllowlist;

  @override
  List<String> get defaultHttpHeadersBlocklist => _defaultConfig.defaultHttpHeadersBlocklist;

  @override
  int get maxCheckpointsPerSpan => _defaultConfig.maxCheckpointsPerSpan;

  @override
  int get maxSpanNameLength => _defaultConfig.maxSpanNameLength;

  @override
  int get maxCheckpointNameLength => _defaultConfig.maxCheckpointNameLength;

  @override
  int get maxAttachmentsInBugReport => _defaultConfig.maxAttachmentsInBugReport;

  @override
  int get maxDescriptionLengthInBugReport => _defaultConfig.maxDescriptionLengthInBugReport;

  @override
  int get screenshotCompressionQuality => _defaultConfig.screenshotCompressionQuality;

  @override
  int get maxEventNameLength => _defaultConfig.maxEventNameLength;

  @override
  String get customEventNameRegex => _defaultConfig.customEventNameRegex;

  @override
  int get maxUserDefinedAttributeValueLength => _defaultConfig.maxUserDefinedAttributeValueLength;

  @override
  int get maxUserDefinedAttributeKeyLength => _defaultConfig.maxUserDefinedAttributeKeyLength;

  @override
  int get maxUserDefinedAttributesPerEvent => _defaultConfig.maxUserDefinedAttributesPerEvent;

  @override
  double get traceSamplingRate => _dynamicConfig.traceSamplingRate;

  @override
  ScreenshotMaskLevel get screenshotMaskLevel => _dynamicConfig.screenshotMaskLevel;

  @override
  bool get crashTakeScreenshot => _dynamicConfig.crashTakeScreenshot;

  @override
  bool get gestureClickTakeSnapshot => _dynamicConfig.gestureClickTakeSnapshot;

  @override
  List<String> get httpDisableEventForUrls => List.unmodifiable(_dynamicConfig.httpDisableEventForUrls);

  @override
  List<String> get httpTrackRequestForUrls => List.unmodifiable(_dynamicConfig.httpTrackRequestForUrls);

  @override
  List<String> get httpTrackResponseForUrls => List.unmodifiable(_dynamicConfig.httpTrackResponseForUrls);

  @override
  List<String> get httpBlockedHeaders => List.unmodifiable(_dynamicConfig.httpBlockedHeaders);

  @override
  bool shouldTrackHttpEvent(String url) {
    final state = _httpPatternState;
    return !state.disableEventPatterns.any((pattern) => pattern.hasMatch(url));
  }

  @override
  bool shouldTrackHttpRequestBody(String url) {
    final state = _httpPatternState;
    return state.trackRequestPatterns.any((pattern) => pattern.hasMatch(url));
  }

  @override
  bool shouldTrackHttpResponseBody(String url) {
    final state = _httpPatternState;
    return state.trackResponsePatterns.any((pattern) => pattern.hasMatch(url));
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    final state = _httpPatternState;
    final keyLower = key.toLowerCase();
    return !defaultHttpHeadersBlocklist.any((h) => h.toLowerCase() == keyLower) &&
        !state.blockedHeaders.any((h) => h.toLowerCase() == keyLower);
  }

  @override
  void setMeasureUrl(String url) {
    final currentState = _httpPatternState;
    _httpPatternState = currentState.copyWith(
      disableEventPatterns: _buildDisableEventPatterns(
        _dynamicConfig.httpDisableEventForUrls,
        url,
      ),
      measureUrl: url,
    );
  }

  @override
  void setDynamicConfig(DynamicConfig dynamicConfig) {
    _dynamicConfig = dynamicConfig;
    final currentMeasureUrl = _httpPatternState.measureUrl;
    _httpPatternState = _HttpPatternState(
      disableEventPatterns: _buildDisableEventPatterns(
        dynamicConfig.httpDisableEventForUrls,
        currentMeasureUrl,
      ),
      trackRequestPatterns: dynamicConfig.httpTrackRequestForUrls
          .map((pattern) => _compilePattern(pattern))
          .toList(),
      trackResponsePatterns: dynamicConfig.httpTrackResponseForUrls
          .map((pattern) => _compilePattern(pattern))
          .toList(),
      blockedHeaders: List.unmodifiable(dynamicConfig.httpBlockedHeaders),
      measureUrl: currentMeasureUrl,
    );
  }

  List<RegExp> _buildDisableEventPatterns(List<String> configUrls, String? measureUrl) {
    final urls = measureUrl != null ? [...configUrls, measureUrl] : configUrls;
    return urls.map((pattern) => _compilePattern(pattern)).toList();
  }

  /// Compiles a URL pattern with wildcard support into a [RegExp].
  ///
  /// The `*` character is treated as a wildcard matching any sequence of characters.
  /// All other regex metacharacters are escaped.
  ///
  /// Example: `https://api.example.com/*` becomes `^https://api\.example\.com/.*$`
  RegExp _compilePattern(String pattern) {
    final String regexPattern;
    if (pattern.contains('*')) {
      regexPattern = pattern
          .split('*')
          .map((part) => RegExp.escape(part))
          .join('.*');
    } else {
      regexPattern = RegExp.escape(pattern);
    }
    return RegExp('^$regexPattern\$', caseSensitive: false);
  }
}
