import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/measure_flutter_platform_interface.dart';
import 'package:measure_flutter/src/method_channel/attribute_value_codec.dart';

class MethodChannelMeasureFlutter extends MeasureFlutterPlatform {
  @visibleForTesting
  final methodChannel = const MethodChannel('measure_flutter');

  @override
  Future<void> trackCustomEvent(String name, int timestamp,
      Map<String, AttributeValue> attributes) async {
    final encodedAttributes = attributes.encode();
    await methodChannel.invokeMethod('trackCustomEvent', {
      'name': name,
      'timestamp': timestamp,
      'attributes': encodedAttributes,
    });
  }
}
