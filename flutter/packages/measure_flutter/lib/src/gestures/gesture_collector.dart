import 'dart:developer';
import 'dart:isolate';

import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_throttler.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import 'click_data.dart';

class GestureCollector {
  final SignalProcessor _signalProcessor;
  final TimeProvider _timeProvider;
  final LayoutSnapshotCollector _layoutSnapshotCollector;
  final LayoutSnapshotThrottler _layoutSnapshotThrottler;
  bool _isRegistered = false;

  GestureCollector(
    SignalProcessor signalProcessor,
    TimeProvider timeProvider,
    LayoutSnapshotCollector layoutSnapshotCollector,
    LayoutSnapshotThrottler layoutSnapshotThrottler,
  )   : _signalProcessor = signalProcessor,
        _timeProvider = timeProvider,
        _layoutSnapshotCollector = layoutSnapshotCollector,
        _layoutSnapshotThrottler = layoutSnapshotThrottler;

  void register() {
    _isRegistered = true;
  }

  void unregister() {
    _isRegistered = false;
  }

  Future<void> trackGestureClick(
    ClickData data, {
    bool isUserTriggered = false,
    SnapshotNode? snapshot,
    int? timestamp,
  }) async {
    final task = TimelineTask()..start('msr-trackGestureClick');
    try {
      if (!_isRegistered) {
        return;
      }
      final eventTimestamp = timestamp ?? _timeProvider.now();
      MsrAttachment? attachment;
      if (snapshot != null && _layoutSnapshotThrottler.shouldTakeSnapshot()) {
        attachment = await _layoutSnapshotCollector.createAttachment(snapshot);
      }
      _signalProcessor.trackEvent(
        data: data,
        type: EventType.gestureClick,
        timestamp: eventTimestamp,
        userDefinedAttrs: {},
        userTriggered: isUserTriggered,
        threadName: Isolate.current.debugName ?? "unknown",
        attachments: attachment != null ? [attachment] : null,
      );
    } finally {
      task.finish();
    }
  }

  void trackGestureScroll(ScrollData scrollData) {
    Timeline.startSync('msr-trackGestureScroll');
    try {
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
    } finally {
      Timeline.finishSync();
    }
  }

  Future<void> trackGestureLongClick(
    LongClickData longClickData, {
    SnapshotNode? snapshot,
    int? timestamp,
  }) async {
    final task = TimelineTask()..start('msr-trackGestureLongClick');
    try {
      if (!_isRegistered) {
        return;
      }
      final eventTimestamp = timestamp ?? _timeProvider.now();
      MsrAttachment? attachment;
      if (snapshot != null && _layoutSnapshotThrottler.shouldTakeSnapshot()) {
        attachment = await _layoutSnapshotCollector.createAttachment(snapshot);
      }
      _signalProcessor.trackEvent(
        data: longClickData,
        type: EventType.gestureLongClick,
        timestamp: eventTimestamp,
        userDefinedAttrs: {},
        userTriggered: false,
        threadName: Isolate.current.debugName ?? "unknown",
        attachments: attachment != null ? [attachment] : null,
      );
    } finally {
      task.finish();
    }
  }
}
