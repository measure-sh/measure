import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

class TestMethodChannel implements MsrMethodChannel {
  final List<
      (
        Map<String, dynamic>,
        String,
        int,
        Map<String, AttributeValue>,
        bool,
        String?
      )> trackedEvents = [];

  @override
  Future<void> trackEvent(
      Map<String, dynamic> data,
      String type,
      int timestamp,
      Map<String, AttributeValue> userDefinedAttrs,
      bool userTriggered,
      String? threadName) async {
    trackedEvents.add(
        (data, type, timestamp, userDefinedAttrs, userTriggered, threadName));
  }
}
