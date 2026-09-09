import 'package:flutter/material.dart';
import 'package:measure_flutter/src/gestures/msr_gesture_detector.dart';

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
