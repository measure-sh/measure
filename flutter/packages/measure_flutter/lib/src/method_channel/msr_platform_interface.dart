import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import '../../measure_flutter.dart';
import '../tracing/span_data.dart';

abstract class MeasureFlutterPlatform extends PlatformInterface {
  MeasureFlutterPlatform() : super(token: _token);

  static final Object _token = Object();

  static MeasureFlutterPlatform _instance = MsrMethodChannel();

  static MeasureFlutterPlatform get instance => _instance;

  static set instance(MeasureFlutterPlatform instance) {
    PlatformInterface.verifyToken(instance, _token);
    _instance = instance;
  }

  Future<void> trackEvent({
    required Map<String, dynamic> data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  }) {
    throw UnimplementedError('trackEvent() has not been implemented.');
  }

  Future<void> triggerNativeCrash() {
    throw UnimplementedError('triggerNativeCrash() has not been implemented.');
  }

  Future<void> start() {
    throw UnimplementedError('start() has not been implemented.');
  }

  Future<void> stop() {
    throw UnimplementedError('stop() has not been implemented.');
  }

  Future<String?> getSessionId() {
    throw UnimplementedError('getSessionId() has not been implemented.');
  }

  Future<void> trackSpan(SpanData data) {
    throw UnimplementedError('trackSpan() has not been implemented.');
  }

  Future<void> setUserId(String userId) {
    throw UnimplementedError('stop() has not been implemented.');
  }

  Future<void> clearUserId() {
    throw UnimplementedError('getUserId() has not been implemented.');
  }

  Future<String?> getAttachmentDirectory() {
    throw UnimplementedError(
        'getAttachmentDirectory() has not been implemented.');
  }

  Future<void> enableShakeDetector() {
    throw UnimplementedError('enableShakeDetector() has not been implemented.');
  }

  Future<void> disableShakeDetector() {
    throw UnimplementedError(
        'disableShakeDetector() has not been implemented.');
  }

  Future<String?> getDynamicConfigPath() {
    throw UnimplementedError('getDynamicConfigPath() has not been implemented.');
  }
}
