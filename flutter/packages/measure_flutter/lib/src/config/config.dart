import 'default_config.dart';
import 'internal_config.dart';
import 'measure_config.dart';

class Config implements InternalConfig, IMeasureConfig {
  const Config({
    this.enableLogging = DefaultConfig.enableLogging,
    this.autoStart = DefaultConfig.autoStart,
    this.maxCheckpointNameLength = DefaultConfig.maxCheckpointNameLength,
    this.maxSpanNameLength = DefaultConfig.maxSpanNameLength,
    this.maxCheckpointsPerSpan = DefaultConfig.maxCheckpointsPerSpan,
    this.maxAttachmentsInBugReport = DefaultConfig.maxAttachmentsInBugReport,
    this.maxDescriptionLengthInBugReport = DefaultConfig.maxDescriptionLengthInBugReport,
    this.screenshotCompressionQuality = DefaultConfig.screenshotCompressionQuality,
    this.maxEventNameLength = DefaultConfig.maxEventNameLength,
    this.customEventNameRegex = DefaultConfig.customEventNameRegex,
    this.maxUserDefinedAttributeKeyLength = DefaultConfig.maxUserDefinedAttributeKeyLength,
    this.maxUserDefinedAttributeValueLength = DefaultConfig.maxUserDefinedAttributeValueLength,
    this.maxUserDefinedAttributesPerEvent = DefaultConfig.maxUserDefinedAttributesPerEvent,
  });

  @override
  final bool enableLogging;
  @override
  final bool autoStart;
  @override
  final int maxCheckpointNameLength;
  @override
  final int maxSpanNameLength;
  @override
  final int maxCheckpointsPerSpan;
  @override
  final int maxAttachmentsInBugReport;
  @override
  final int maxDescriptionLengthInBugReport;
  @override
  final int screenshotCompressionQuality;
  @override
  final int maxEventNameLength;
  @override
  final String customEventNameRegex;
  @override
  final int maxUserDefinedAttributesPerEvent;
  @override
  final int maxUserDefinedAttributeKeyLength;
  @override
  final int maxUserDefinedAttributeValueLength;

  @override
  List<String> get defaultHttpContentTypeAllowlist => const ["application/json"];

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
    bool? autoStart,
    bool? enableFullCollectionMode,
  }) {
    return Config(
      enableLogging: enableLogging ?? this.enableLogging,
      autoStart: autoStart ?? this.autoStart,
    );
  }
}
