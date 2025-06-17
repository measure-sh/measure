import 'package:flutter/services.dart';
import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/method_channel/attribute_value_codec.dart';
import 'package:measure_flutter/src/method_channel/method_constants.dart';
import 'package:measure_flutter/src/method_channel/msr_platform_interface.dart';

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
}
