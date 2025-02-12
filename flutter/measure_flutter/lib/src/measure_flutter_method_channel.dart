import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/attribute_value_codec.dart';

import 'measure_flutter_platform_interface.dart';

class MethodChannelMeasureFlutter extends MeasureFlutterPlatform {
  @visibleForTesting
  final methodChannel = const MethodChannel('measure_flutter');

  @override
  Future<String?> getPlatformVersion() async {
    final version =
        await methodChannel.invokeMethod<String>('getPlatformVersion');
    return version;
  }

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
