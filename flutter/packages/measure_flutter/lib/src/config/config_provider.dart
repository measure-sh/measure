import 'config.dart';
import 'internal_config.dart';
import 'measure_config.dart';

abstract class ConfigProvider implements IMeasureConfig, InternalConfig {
  bool shouldTrackHttpBody(String url, String? contentType);

  bool shouldTrackHttpUrl(String url);

  bool shouldTrackHttpHeader(String key);
}

class ConfigProviderImpl implements ConfigProvider {
  ConfigProviderImpl({
    required Config defaultConfig,
  }) : _defaultConfig = defaultConfig;

  final Config _defaultConfig;

  List<String> get _combinedHttpHeadersBlocklist =>
      _defaultConfig.defaultHttpHeadersBlocklist + httpHeadersBlocklist;

  @override
  bool get enableLogging => _defaultConfig.enableLogging;

  @override
  bool get trackHttpHeaders => _defaultConfig.trackHttpHeaders;

  @override
  bool get trackHttpBody => _defaultConfig.trackHttpBody;

  @override
  List<String> get httpHeadersBlocklist => _defaultConfig.httpHeadersBlocklist;

  @override
  List<String> get httpUrlBlocklist => _defaultConfig.httpUrlBlocklist;

  @override
  List<String> get httpUrlAllowlist => _defaultConfig.httpUrlAllowlist;

  @override
  List<String> get defaultHttpContentTypeAllowlist =>
      _defaultConfig.defaultHttpContentTypeAllowlist;

  @override
  List<String> get defaultHttpHeadersBlocklist =>
      _defaultConfig.defaultHttpHeadersBlocklist;

  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    if (!trackHttpBody) {
      return false;
    }

    if (contentType == null || contentType.isEmpty) {
      return false;
    }

    return defaultHttpContentTypeAllowlist.any(
        (type) => contentType.toLowerCase().startsWith(type.toLowerCase()));
  }

  @override
  bool shouldTrackHttpUrl(String url) {
    // If the allowlist is not empty, then only allow the URLs that are in the allowlist.
    if (httpUrlAllowlist.isNotEmpty) {
      return httpUrlAllowlist.any(
          (allowedUrl) => url.toLowerCase().contains(allowedUrl.toLowerCase()));
    }

    // If the allowlist is empty, then block the URLs that are in the blocklist.
    return !httpUrlBlocklist.any(
        (blockedUrl) => url.toLowerCase().contains(blockedUrl.toLowerCase()));
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    if (!trackHttpHeaders) {
      return false;
    }
    return !_combinedHttpHeadersBlocklist
        .any((header) => key.toLowerCase().contains(header.toLowerCase()));
  }
}
