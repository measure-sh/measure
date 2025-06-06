import 'default_config.dart';
import 'internal_config.dart';
import 'measure_config.dart';

class Config implements InternalConfig, IMeasureConfig {
  const Config({
    this.enableLogging = DefaultConfig.enableLogging,
    this.trackHttpHeaders = DefaultConfig.trackHttpHeaders,
    this.trackHttpBody = DefaultConfig.trackHttpBody,
    this.httpHeadersBlocklist = DefaultConfig.httpHeadersBlocklist,
    this.httpUrlBlocklist = DefaultConfig.httpUrlBlocklist,
    this.httpUrlAllowlist = DefaultConfig.httpUrlAllowlist,
  });

  @override
  final bool enableLogging;
  @override
  final bool trackHttpHeaders;
  @override
  final bool trackHttpBody;
  @override
  final List<String> httpHeadersBlocklist;
  @override
  final List<String> httpUrlBlocklist;
  @override
  final List<String> httpUrlAllowlist;

  @override
  List<String> get defaultHttpContentTypeAllowlist =>
      const ["application/json"];

  @override
  List<String> get defaultHttpHeadersBlocklist => const [
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
      ];

  Config copyWith({
    bool? enableLogging,
    bool? trackHttpHeaders,
    bool? trackHttpBody,
    List<String>? httpHeadersBlocklist,
    List<String>? httpUrlBlocklist,
    List<String>? httpUrlAllowlist,
    List<String>? httpContentTypeAllowlist,
    List<String>? defaultHttpHeadersBlocklist,
  }) {
    return Config(
      enableLogging: enableLogging ?? this.enableLogging,
      trackHttpHeaders: trackHttpHeaders ?? this.trackHttpHeaders,
      trackHttpBody: trackHttpBody ?? this.trackHttpBody,
      httpHeadersBlocklist: httpHeadersBlocklist ?? this.httpHeadersBlocklist,
      httpUrlBlocklist: httpUrlBlocklist ?? this.httpUrlBlocklist,
      httpUrlAllowlist: httpUrlAllowlist ?? this.httpUrlAllowlist,
    );
  }
}
