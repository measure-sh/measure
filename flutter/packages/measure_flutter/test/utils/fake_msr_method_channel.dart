import 'package:flutter/services.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

class FakeMethodChannel extends MsrMethodChannel {
  Future<void> Function(MethodCall call)? handler;

  @override
  void setMethodCallHandler(
      Future<void> Function(MethodCall call) handleMethodCall) {
    handler = handleMethodCall;
  }

  // Simulate a method call from the native side
  Future<void> simulateMethodCall(String method, [dynamic arguments]) async {
    if (handler != null) {
      await handler!(MethodCall(method, arguments));
    }
  }

  @override
  Future<void> trackEvent({
    required Map<String, dynamic> data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  }) =>
      throw UnimplementedError();

  @override
  Future<void> triggerNativeCrash() => throw UnimplementedError();

  @override
  Future<void> initializeNativeSDK(
    Map<String, dynamic> config,
    Map<String, String> clientInfo,
  ) =>
      throw UnimplementedError();

  @override
  Future<void> start() => throw UnimplementedError();

  @override
  Future<void> stop() => throw UnimplementedError();

  @override
  Future<String?> getSessionId() => throw UnimplementedError();

  @override
  Future<void> trackSpan(dynamic data) => throw UnimplementedError();

  @override
  Future<void> clearUserId() => throw UnimplementedError();

  @override
  Future<void> setUserId(String userId) => throw UnimplementedError();

  @override
  Future<String?> getAttachmentDirectory() => throw UnimplementedError();

  @override
  Future<void> enableShakeDetector() => throw UnimplementedError();

  @override
  Future<void> disableShakeDetector() => throw UnimplementedError();
}
