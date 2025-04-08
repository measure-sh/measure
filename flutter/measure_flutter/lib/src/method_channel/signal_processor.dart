import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

abstract interface class SignalProcessor {
  void trackCustomEvent(
    String name,
    DateTime timestamp,
    Map<String, AttributeValue> attributes,
  );

  Future<void> trackException(
      Map<String, dynamic> exceptionData, DateTime timestamp);
}

final class DefaultSignalProcessor extends SignalProcessor {
  final Logger logger;
  final MsrMethodChannel channel;

  DefaultSignalProcessor({required this.logger, required this.channel});

  @override
  void trackCustomEvent(
      String name, DateTime timestamp, Map<String, AttributeValue> attributes) {
    try {
      channel.trackCustomEvent(
          name, timestamp.millisecondsSinceEpoch, attributes);
    } catch (e) {
      logger.log(LogLevel.error, "Unable to track custom event", e);
    }
  }

  @override
  Future<void> trackException(
      Map<String, dynamic> exceptionData, DateTime timestamp) {
    try {
      return channel.trackException(
          exceptionData, timestamp.millisecondsSinceEpoch);
    } catch (e) {
      logger.log(LogLevel.error, "Unable to track exception", e);
      return Future.error(e);
    }
  }
}
