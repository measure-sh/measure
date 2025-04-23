import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';

abstract interface class SignalProcessor {
  void trackEvent<T extends JsonSerialized>({
    required T data,
    required String type,
    required DateTime timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
  });
}

final class DefaultSignalProcessor extends SignalProcessor {
  final Logger logger;
  final MsrMethodChannel channel;

  DefaultSignalProcessor({required this.logger, required this.channel});

  @override
  void trackEvent<T extends JsonSerialized>({
    required T data,
    required String type,
    required DateTime timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
  }) {
    try {
      channel.trackEvent(data.toJson(), type, timestamp.millisecondsSinceEpoch,
          userDefinedAttrs, userTriggered, threadName);
    } catch (e) {
      logger.log(LogLevel.error, "Unable to track event", e);
    }
  }
}
