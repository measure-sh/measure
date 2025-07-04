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

  /// The maximum allowed attachments in a bug report. Defaults to 5.
  int get maxAttachmentsInBugReport;

  /// The maximum allowed characters in a bug report. Defaults to 1000.
  int get maxDescriptionLengthInBugReport;

  /// The compression quality of the screenshot. Must be between 0 and 100, where 0 is lowest quality
  /// and smallest size while 100 is highest quality and largest size.
  int get screenshotCompressionQuality;
}
