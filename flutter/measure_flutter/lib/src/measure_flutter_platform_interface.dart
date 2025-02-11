import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import 'measure_flutter_method_channel.dart';

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
}
