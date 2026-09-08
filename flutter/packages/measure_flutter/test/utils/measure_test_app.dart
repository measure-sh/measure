import 'package:flutter/material.dart';
import 'package:measure_flutter/src/gestures/msr_gesture_detector.dart';

/// An app wrapped the way [MeasureWidget] wraps one, which is what registers
/// the element whole screen layout snapshots are captured from.
Widget measureApp({Key? detectorKey, Widget child = const Scaffold()}) {
  return MaterialApp(
    home: MsrGestureDetector(
      key: detectorKey,
      layoutSnapshotWidgetFilter: const {},
      onClick: (data, snapshot, timestamp) async {},
      onLongClick: (data, snapshot, timestamp) async {},
      onScroll: (data) async {},
      child: child,
    ),
  );
}
