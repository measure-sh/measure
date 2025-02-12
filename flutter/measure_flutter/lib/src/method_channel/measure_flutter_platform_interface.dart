import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/measure_flutter_method_channel.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

abstract class MeasureFlutterPlatform extends PlatformInterface {
  MeasureFlutterPlatform() : super(token: _token);

  static final Object _token = Object();

  static MeasureFlutterPlatform _instance = MethodChannelMeasureFlutter();

  static MeasureFlutterPlatform get instance => _instance;

  static set instance(MeasureFlutterPlatform instance) {
    PlatformInterface.verifyToken(instance, _token);
    _instance = instance;
  }

  Future<String?> getPlatformVersion() {
    throw UnimplementedError('platformVersion() has not been implemented.');
  }

  Future<void> trackCustomEvent(
      String name, int timestamp, Map<String, AttributeValue> attributes) {
    throw UnimplementedError('trackCustomEvent() has not been implemented.');
  }
}
