import 'package:flutter/services.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/attribute_value_codec.dart';
import 'package:measure_flutter/src/method_channel/method_constants.dart';
import 'package:measure_flutter/src/method_channel/msr_platform_interface.dart';

class MsrMethodChannel extends MeasureFlutterPlatform {
  final _methodChannel = const MethodChannel('measure_flutter');

  @override
  Future<void> trackCustomEvent(String name, int timestamp,
      Map<String, AttributeValue> attributes) async {
    final encodedAttributes = attributes.encode();
    await _methodChannel
        .invokeMethod(MethodConstants.functionTrackCustomEvent, {
      MethodConstants.argName: name,
      MethodConstants.argTimestamp: timestamp,
      MethodConstants.argAttributes: encodedAttributes,
    });
  }
}
