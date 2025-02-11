import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'measure_flutter_platform_interface.dart';

class MethodChannelMeasureFlutter extends MeasureFlutterPlatform {
  @visibleForTesting
  final methodChannel = const MethodChannel('measure_flutter');

  @override
  Future<String?> getPlatformVersion() async {
    final version = await methodChannel.invokeMethod<String>('getPlatformVersion');
    return version;
  }
}
