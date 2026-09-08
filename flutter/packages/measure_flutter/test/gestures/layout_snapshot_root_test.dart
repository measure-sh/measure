import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/msr_gesture_detector.dart';

import '../utils/measure_test_app.dart';

void main() {
  group('layoutSnapshotRootElement', () {
    testWidgets('is the mounted detector', (tester) async {
      await tester.pumpWidget(measureApp());

      expect(layoutSnapshotRootElement,
          equals(tester.element(find.byType(MsrGestureDetector))));
    });

    testWidgets('is null once the detector leaves the tree', (tester) async {
      await tester.pumpWidget(measureApp());

      await tester.pumpWidget(const MaterialApp(home: Scaffold()));

      expect(layoutSnapshotRootElement, isNull);
    });

    // The replacement mounts before the old detector is unmounted at the end of
    // the frame, so the departing one must not clear the newcomer.
    testWidgets('survives one detector replacing another', (tester) async {
      await tester.pumpWidget(measureApp(detectorKey: const ValueKey('first')));

      await tester.pumpWidget(measureApp(detectorKey: const ValueKey('second')));

      expect(layoutSnapshotRootElement,
          equals(tester.element(find.byType(MsrGestureDetector))));
    });
  });
}
