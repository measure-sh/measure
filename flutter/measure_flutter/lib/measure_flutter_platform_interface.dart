import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import 'measure_flutter_method_channel.dart';

abstract class MeasureFlutterPlatform extends PlatformInterface {
  /// Constructs a MeasureFlutterPlatform.
  MeasureFlutterPlatform() : super(token: _token);

  static final Object _token = Object();

  static MeasureFlutterPlatform _instance = MethodChannelMeasureFlutter();

  /// The default instance of [MeasureFlutterPlatform] to use.
  ///
  /// Defaults to [MethodChannelMeasureFlutter].
  static MeasureFlutterPlatform get instance => _instance;

  /// Platform-specific implementations should set this with their own
  /// platform-specific class that extends [MeasureFlutterPlatform] when
  /// they register themselves.
  static set instance(MeasureFlutterPlatform instance) {
    PlatformInterface.verifyToken(instance, _token);
    _instance = instance;
  }

  Future<String?> getPlatformVersion() {
    throw UnimplementedError('platformVersion() has not been implemented.');
  }
}
