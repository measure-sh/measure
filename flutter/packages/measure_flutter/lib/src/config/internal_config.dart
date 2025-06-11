abstract class InternalConfig {
  /// When `httpBodyCapture` is enabled, this determines whether to capture the body or not based
  /// on the content type of the request/response. Defaults to `application/json`.
  List<String> get defaultHttpContentTypeAllowlist;

  /// Default list of HTTP headers to not capture for network request and response.
  List<String> get defaultHttpHeadersBlocklist;

  /// The maximum allowed checkpoints for a span. Defaults to 100.
  int get maxCheckpointsPerSpan;

  /// The maximum length of a span name. Defaults to 64.
  int get maxSpanNameLength;

  /// The maximum length of a checkpoint name. Defaults to 64.
  int get maxCheckpointNameLength;
}
