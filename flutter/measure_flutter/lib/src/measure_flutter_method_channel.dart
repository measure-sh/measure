import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'measure_flutter_platform_interface.dart';

/// An implementation of [MeasureFlutterPlatform] that uses method channels.
class MethodChannelMeasureFlutter extends MeasureFlutterPlatform {
  /// The method channel used to interact with the native platform.
  @visibleForTesting
  final methodChannel = const MethodChannel('measure_flutter');

  @override
  Future<String?> getPlatformVersion() async {
    final version = await methodChannel.invokeMethod<String>('getPlatformVersion');
    return version;
  }
}
