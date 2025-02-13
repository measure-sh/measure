import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

class TestMethodChannel implements MsrMethodChannel {
  final List<(String, int, Map<String, AttributeValue>)> trackedEvents = [];

  @override
  Future<void> trackCustomEvent(String name, int timestamp,
      Map<String, AttributeValue> attributes) async {
    trackedEvents.add((name, timestamp, attributes));
  }
}
