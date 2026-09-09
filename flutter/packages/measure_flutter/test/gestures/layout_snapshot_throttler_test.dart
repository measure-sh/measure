import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_throttler.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/test_clock.dart';

void main() {
  group('LayoutSnapshotThrottler', () {
    late TestClock clock;
    late LayoutSnapshotThrottler throttler;

    setUp(() {
      clock = TestClock.create();
      throttler = LayoutSnapshotThrottler(FlutterTimeProvider(clock));
    });

    test('allows the first snapshot', () {
      expect(throttler.shouldTakeSnapshot(), isTrue);
    });

    test('blocks a snapshot taken too soon after the previous one', () {
      throttler.shouldTakeSnapshot();

      expect(throttler.shouldTakeSnapshot(), isFalse);
    });

    test('allows a snapshot once the delay has elapsed', () {
      throttler.shouldTakeSnapshot();
      clock.advance(const Duration(milliseconds: 751));

      expect(throttler.shouldTakeSnapshot(), isTrue);
    });

    test('respects a custom delay', () {
      throttler.shouldTakeSnapshot(delayMs: 100);
      clock.advance(const Duration(milliseconds: 50));

      expect(throttler.shouldTakeSnapshot(delayMs: 100), isFalse);

      clock.advance(const Duration(milliseconds: 101));

      expect(throttler.shouldTakeSnapshot(delayMs: 100), isTrue);
    });
  });
}
