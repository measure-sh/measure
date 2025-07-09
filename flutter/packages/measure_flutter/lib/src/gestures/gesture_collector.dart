import 'dart:isolate';

import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import 'click_data.dart';

class GestureCollector {
  final SignalProcessor _signalProcessor;
  final TimeProvider _timeProvider;
  bool _isRegistered = false;

  GestureCollector(
    SignalProcessor signalProcessor,
    TimeProvider timeProvider,
  )   : _signalProcessor = signalProcessor,
        _timeProvider = timeProvider;

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
      timestamp: _timeProvider.now(),
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
      timestamp: _timeProvider.now(),
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
      timestamp: _timeProvider.now(),
      userDefinedAttrs: {},
      userTriggered: false,
      threadName: Isolate.current.debugName ?? "unknown",
    );
  }
}
