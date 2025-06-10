import 'default_config.dart';

abstract class IMeasureConfig {
  bool get enableLogging;

  bool get trackHttpHeaders;

  bool get trackHttpBody;

  List<String> get httpHeadersBlocklist;

  List<String> get httpUrlBlocklist;

  List<String> get httpUrlAllowlist;
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on
/// initialization.
final class MeasureConfig implements IMeasureConfig {
  /// Creates a new [MeasureConfig] with the specified options.
  const MeasureConfig({
    /// Enable or disable internal SDK logs. Defaults to `false`.
    this.enableLogging = DefaultConfig.enableLogging,

    /// Whether to capture http headers of a network request and response. Defaults to `false`.
    this.trackHttpHeaders = DefaultConfig.trackHttpHeaders,

    /// Whether to capture http body of a network request and response. Defaults to `false`.
    this.trackHttpBody = DefaultConfig.trackHttpBody,

    /// List of HTTP headers to not collect with the `http` event for both request and response.
    /// Defaults to an empty list. The following headers are always excluded:
    /// * Authorization
    /// * Cookie
    /// * Set-Cookie
    /// * Proxy-Authorization
    /// * WWW-Authenticate
    /// * X-Api-Key
    this.httpHeadersBlocklist = DefaultConfig.httpHeadersBlocklist,

    /// Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not
    /// want to collect data for certain endpoints.
    ///
    /// The check is made using [String.contains] to see if the URL contains any of the strings in
    /// the list.
    ///
    /// Note that this config is ignored if [httpUrlAllowlist] is set.
    ///
    /// Example:
    ///
    /// ```dart
    /// MeasureConfig(
    ///   httpUrlBlocklist: [
    ///     "example.com", // disables a domain
    ///     "api.example.com", // disable a subdomain
    ///     "example.com/order" // disable a particular path
    ///   ]
    /// )
    /// ```
    this.httpUrlBlocklist = DefaultConfig.httpUrlBlocklist,

    /// Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not
    /// want to collect data for all endpoints except for a few.
    ///
    /// The check is made using [String.contains] to see if the URL contains any of the strings in
    /// the list.
    ///
    /// Example:
    ///
    /// ```dart
    /// MeasureConfig(
    ///   httpUrlAllowlist: [
    ///     "example.com", // enables a domain
    ///     "api.example.com", // enable a subdomain
    ///     "example.com/order" // enable a particular path
    ///   ]
    /// )
    /// ```
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
}
