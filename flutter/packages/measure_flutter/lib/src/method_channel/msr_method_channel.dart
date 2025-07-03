import 'package:flutter/services.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/events/attachment_codec.dart';
import 'package:measure_flutter/src/method_channel/attribute_value_codec.dart';
import 'package:measure_flutter/src/method_channel/method_constants.dart';
import 'package:measure_flutter/src/method_channel/msr_platform_interface.dart';

import '../tracing/span_data.dart';

class MsrMethodChannel extends MeasureFlutterPlatform {
  final _methodChannel = const MethodChannel('measure_flutter');

  @override
  Future<void> trackEvent({
    required Map<String, dynamic> data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  }) {
    final encodedAttributes = userDefinedAttrs.encode();
    final encodedAttachments = attachments?.encode();
    return _methodChannel.invokeMethod(MethodConstants.functionTrackEvent, {
      MethodConstants.argEventData: data,
      MethodConstants.argEventType: type,
      MethodConstants.argTimestamp: timestamp,
      MethodConstants.argUserDefinedAttrs: encodedAttributes,
      MethodConstants.argUserTriggered: userTriggered,
      MethodConstants.argThreadName: threadName,
      MethodConstants.argAttachments: encodedAttachments,
    });
  }

  @override
  Future<void> triggerNativeCrash() {
    return _methodChannel
        .invokeMethod(MethodConstants.functionTriggerNativeCrash);
  }

  @override
  Future<void> initializeNativeSDK(
    Map<String, dynamic> config,
    Map<String, String> clientInfo,
  ) {
    return _methodChannel
        .invokeMethod(MethodConstants.functionInitializeNativeSDK, {
      MethodConstants.argConfig: config,
      MethodConstants.argClientInfo: clientInfo,
    });
  }

  @override
  Future<void> start() {
    return _methodChannel.invokeMethod(MethodConstants.functionStart);
  }

  @override
  Future<void> stop() {
    return _methodChannel.invokeMethod(MethodConstants.functionStop);
  }

  @override
  Future<String?> getSessionId() {
    return _methodChannel.invokeMethod(MethodConstants.functionGetSessionId);
  }

  @override
  Future<void> trackSpan(SpanData data) {
    final checkpointsMap = {
      for (var cp in data.checkpoints) cp.name: cp.timestamp,
    };
    return _methodChannel.invokeMethod(MethodConstants.functionTrackSpan, {
      MethodConstants.argSpanName: data.name,
      MethodConstants.argSpanTraceId: data.traceId,
      MethodConstants.argSpanSpanId: data.spanId,
      MethodConstants.argSpanParentId: data.parentId,
      MethodConstants.argSpanStartTime: data.startTime,
      MethodConstants.argSpanEndTime: data.endTime,
      MethodConstants.argSpanDuration: data.duration,
      MethodConstants.argSpanStatus: data.status.value,
      MethodConstants.argSpanAttributes: data.attributes,
      MethodConstants.argSpanUserDefinedAttrs: data.userDefinedAttrs,
      MethodConstants.argSpanCheckpoints: checkpointsMap,
      MethodConstants.argSpanHasEnded: data.hasEnded,
      MethodConstants.argSpanIsSampled: data.isSampled,
    });
  }

  @override
  Future<void> clearUserId() {
    return _methodChannel.invokeMethod(MethodConstants.functionClearUserId);
  }

  @override
  Future<void> setUserId(String userId) {
    return _methodChannel.invokeMethod(MethodConstants.functionSetUserId, {
      MethodConstants.argUserId: userId,
    });
  }

  @override
  Future<String?> getAttachmentDirectory() {
    return _methodChannel
        .invokeMethod(MethodConstants.functionGetAttachmentDirectory);
  }

  @override
  Future<void> enableShakeDetector() {
    return _methodChannel
        .invokeMethod(MethodConstants.functionEnableShakeDetector);
  }

  @override
  Future<void> disableShakeDetector() {
    return _methodChannel
        .invokeMethod(MethodConstants.functionDisableShakeDetector);
  }

  void setMethodCallHandler(
      Future<void> Function(MethodCall call) handleMethodCall) {
    _methodChannel.setMethodCallHandler(handleMethodCall);
  }
}
