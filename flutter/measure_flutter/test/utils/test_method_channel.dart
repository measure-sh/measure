import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

class TestMethodChannel implements MsrMethodChannel {
  final List<(String, int, Map<String, AttributeValue>)> trackedCustomEvents =
      [];
  final List<(Map<String, dynamic> serializedData, int timestamp)> trackedExceptions = [];


  @override
  Future<void> trackCustomEvent(String name, int timestamp,
      Map<String, AttributeValue> attributes) async {
    trackedCustomEvents.add((name, timestamp, attributes));
  }

  @override
  Future<void> triggerNativeCrash() async {
    // No-op
  }

  @override
  Future<void> trackFlutterException(
      Map<String, dynamic> serializedData, int timestamp) async {
    trackedExceptions.add((serializedData, timestamp));
  }
}
