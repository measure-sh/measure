import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';
import 'package:measure_flutter/src/tracing/span_data.dart';

abstract interface class SignalProcessor {
  Future<void> trackEvent<T extends JsonSerialized>({
    required T data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  });

  Future<void> trackSpan(SpanData spanData);
}

final class DefaultSignalProcessor extends SignalProcessor {
  final Logger logger;
  final MsrMethodChannel channel;

  DefaultSignalProcessor({required this.logger, required this.channel});

  @override
  Future<void> trackEvent<T extends JsonSerialized>({
    required T data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  }) {
    var json = data.toJson();
    logger.log(LogLevel.debug, "$type: $json");
    return channel.trackEvent(
        data: json,
        type: type,
        timestamp: timestamp,
        userDefinedAttrs: userDefinedAttrs,
        userTriggered: userTriggered,
        threadName: threadName,
        attachments: attachments,
    );
  }

  @override
  Future<void> trackSpan(SpanData spanData) {
    logger.log(LogLevel.debug, "Track span: $spanData");
    return channel.trackSpan(spanData);
  }
}
