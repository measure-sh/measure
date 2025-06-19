import 'package:flutter/services.dart';
import 'package:measure_flutter/src/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/attribute_value_codec.dart';
import 'package:measure_flutter/src/method_channel/method_constants.dart';
import 'package:measure_flutter/src/method_channel/msr_platform_interface.dart';

import '../tracing/span_data.dart';

class MsrMethodChannel extends MeasureFlutterPlatform {
  final _methodChannel = const MethodChannel('measure_flutter');

  @override
  Future<void> trackEvent(
      Map<String, dynamic> data,
      String type,
      int timestamp,
      Map<String, AttributeValue> userDefinedAttrs,
      bool userTriggered,
      String? threadName) async {
    final encodedAttributes = userDefinedAttrs.encode();
    try {
      return _methodChannel.invokeMethod(MethodConstants.functionTrackEvent, {
        MethodConstants.argEventData: data,
        MethodConstants.argEventType: type,
        MethodConstants.argTimestamp: timestamp,
        MethodConstants.argUserDefinedAttrs: encodedAttributes,
        MethodConstants.argUserTriggered: userTriggered,
        MethodConstants.argThreadName: threadName,
      });
    } catch (e, stackTrace) {
      return Future.error(e, stackTrace);
    }
  }

  @override
  Future<void> triggerNativeCrash() async {
    return _methodChannel
        .invokeMethod(MethodConstants.functionTriggerNativeCrash);
  }

  @override
  Future<void> initializeNativeSDK(
    Map<String, dynamic> config,
    Map<String, String> clientInfo,
  ) async {
    return _methodChannel
        .invokeMethod(MethodConstants.functionInitializeNativeSDK, {
      MethodConstants.argConfig: config,
      MethodConstants.argClientInfo: clientInfo,
    });
  }

  @override
  Future<void> start() async {
    return _methodChannel.invokeMethod(MethodConstants.functionStart);
  }

  @override
  Future<void> stop() async {
    return _methodChannel.invokeMethod(MethodConstants.functionStop);
  }

  @override
  Future<String?> getSessionId() {
    return _methodChannel.invokeMethod(MethodConstants.functionGetSessionId);
  }

  @override
  Future<void> trackSpan(SpanData data) async {
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
}
