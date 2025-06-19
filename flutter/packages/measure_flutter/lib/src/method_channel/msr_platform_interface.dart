import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

abstract class MeasureFlutterPlatform extends PlatformInterface {
  MeasureFlutterPlatform() : super(token: _token);

  static final Object _token = Object();

  static MeasureFlutterPlatform _instance = MsrMethodChannel();

  static MeasureFlutterPlatform get instance => _instance;

  static set instance(MeasureFlutterPlatform instance) {
    PlatformInterface.verifyToken(instance, _token);
    _instance = instance;
  }

  Future<void> trackEvent(
      Map<String, dynamic> data,
      String type,
      int timestamp,
      Map<String, AttributeValue> userDefinedAttrs,
      bool userTriggered,
      String threadName) {
    throw UnimplementedError('trackEvent() has not been implemented.');
  }

  Future<void> triggerNativeCrash() {
    throw UnimplementedError('triggerNativeCrash() has not been implemented.');
  }

  Future<void> initializeNativeSDK(
    Map<String, dynamic> config,
    Map<String, String> clientInfo,
  ) {
    throw UnimplementedError('initializeNativeSDK() has not been implemented.');
  }

  Future<void> start() {
    throw UnimplementedError('start() has not been implemented.');
  }

  Future<void> stop() {
    throw UnimplementedError('stop() has not been implemented.');
  }
}
