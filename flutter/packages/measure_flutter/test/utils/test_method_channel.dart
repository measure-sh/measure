import 'package:measure_flutter/src/attribute_value.dart';
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
  Future<void> trackEvent(
      Map<String, dynamic> data,
      String type,
      int timestamp,
      Map<String, AttributeValue> userDefinedAttrs,
      bool userTriggered,
      String? threadName) async {
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
}
