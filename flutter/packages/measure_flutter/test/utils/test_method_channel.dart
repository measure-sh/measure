import 'package:flutter/src/services/message_codec.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/tracing/span_data.dart';

class TestMethodChannel implements MsrMethodChannel {
  String? _sessionId = "test-session-id";
  String? userId;

  final List<
      (
        Map<String, dynamic>,
        String,
        int,
        Map<String, AttributeValue>,
        bool,
        String?
      )> trackedEvents = [];

  @override
  Future<void> trackEvent({
    required Map<String, dynamic> data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  }) async {
    trackedEvents.add(
        (data, type, timestamp, userDefinedAttrs, userTriggered, threadName));
  }

  @override
  Future<void> triggerNativeCrash() {
    throw UnimplementedError();
  }

  @override
  Future<void> initializeNativeSDK(
    Map<String, dynamic> config,
    Map<String, String> clientInfo,
  ) async {
    // no-op
  }

  @override
  Future<String?> getSessionId() async {
    return _sessionId;
  }

  void setSessionId(String? id) {
    _sessionId = id;
  }

  @override
  Future<void> trackSpan(SpanData data) {
    throw UnimplementedError();
  }

  @override
  Future<void> start() {
    throw UnimplementedError();
  }

  @override
  Future<void> stop() {
    throw UnimplementedError();
  }

  @override
  Future<void> setUserId(String userId) async {
    this.userId = userId;
  }

  @override
  Future<void> clearUserId() async {
    userId = null;
  }

  @override
  Future<String?> getAttachmentDirectory() {
    throw UnimplementedError();
  }

  @override
  Future<void> disableShakeDetector() {
    throw UnimplementedError();
  }

  @override
  Future<void> enableShakeDetector() {
    throw UnimplementedError();
  }

  @override
  void setMethodCallHandler(
      Future<void> Function(MethodCall call) handleMethodCall) {
    throw UnimplementedError();
  }
}
