import 'dart:isolate';

import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';

import 'click_data.dart';

class GestureCollector {
  final SignalProcessor _signalProcessor;
  bool _isRegistered = false;

  GestureCollector(
    SignalProcessor signalProcessor,
  ) : _signalProcessor = signalProcessor;

  void register() {
    _isRegistered = true;
  }

  void unregister() {
    _isRegistered = false;
  }

  void trackGestureClick(ClickData data, {bool isUserTriggered = false}) {
    if (!_isRegistered) {
      return;
    }
    _signalProcessor.trackEvent(
      data: data,
      type: EventType.gestureClick,
      timestamp: DateTime.now(),
      userDefinedAttrs: {},
      userTriggered: isUserTriggered,
      threadName: Isolate.current.debugName ?? "unknown",
    );
  }

  void trackGestureScroll(ScrollData scrollData) {
    if (!_isRegistered) {
      return;
    }

    _signalProcessor.trackEvent(
      data: scrollData,
      type: EventType.gestureScroll,
      timestamp: DateTime.now(),
      userDefinedAttrs: {},
      userTriggered: false,
      threadName: Isolate.current.debugName ?? "unknown",
    );
  }

  void trackGestureLongClick(LongClickData longClickData) {
    if (!_isRegistered) {
      return;
    }

    _signalProcessor.trackEvent(
      data: longClickData,
      type: EventType.gestureLongClick,
      timestamp: DateTime.now(),
      userDefinedAttrs: {},
      userTriggered: false,
      threadName: Isolate.current.debugName ?? "unknown",
    );
  }
}
