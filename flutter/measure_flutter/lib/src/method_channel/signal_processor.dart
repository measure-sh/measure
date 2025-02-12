import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

final class SignalProcessor {
  final Logger logger;
  final MsrMethodChannel channel;

  SignalProcessor({required this.logger, required this.channel});

  void trackCustomEvent(
      String name, DateTime timestamp, Map<String, AttributeValue> attributes) {
    try {
      channel.trackCustomEvent(
          name, timestamp.millisecondsSinceEpoch, attributes);
    } catch (e) {
      logger.log(LogLevel.error, "Unable to track custom event", e);
    }
  }
}
