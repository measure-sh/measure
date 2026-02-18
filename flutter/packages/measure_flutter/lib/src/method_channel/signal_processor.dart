import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
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
  final ConfigProvider configProvider;

  DefaultSignalProcessor(
      {required this.logger,
      required this.channel,
      required this.configProvider});

  @override
  Future<void> trackEvent<T extends JsonSerialized>({
    required T data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  }) async {
    if (!validateUserDefinedAttrs(type, userDefinedAttrs)) {
      return;
    }
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

  bool validateUserDefinedAttrs(
      String event, Map<String, AttributeValue> userDefinedAttrs) {
    if (userDefinedAttrs.length >
        configProvider.maxUserDefinedAttributesPerEvent) {
      logger.log(
        LogLevel.error,
        'Invalid event($event): exceeds maximum of ${configProvider.maxUserDefinedAttributesPerEvent} attributes',
      );
      return false;
    }

    return userDefinedAttrs.entries.every((entry) {
      final key = entry.key;
      final value = entry.value;

      final isKeyValid = _isKeyValid(key);
      final isValueValid = _isValueValid(value);

      if (!isKeyValid) {
        logger.log(
          LogLevel.error,
          'Invalid event($event): invalid attribute key: $key',
        );
      }

      if (!isValueValid) {
        logger.log(
          LogLevel.error,
          'Invalid event($event): invalid attribute value: $value',
        );
      }

      return isKeyValid && isValueValid;
    });
  }

  bool _isKeyValid(String key) {
    return key.length <= configProvider.maxUserDefinedAttributeKeyLength;
  }

  bool _isValueValid(AttributeValue value) {
    if (value is StringAttr) {
      String str = value.value as String;
      return str.length <= configProvider.maxUserDefinedAttributeValueLength;
    }
    return true;
  }
}
