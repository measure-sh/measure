import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/gesture_collector.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_throttler.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/msr_scroll_direction.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_layout_snapshot_collector.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/test_clock.dart';

void main() {
  late FakeSignalProcessor signalProcessor;
  late TestClock clock;
  late GestureCollector collector;

  final snapshot = SnapshotNode(
    label: 'Button',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    children: [],
  );
  final attachment = MsrAttachment.fromPath(
    path: 'snapshot-path',
    type: AttachmentType.layoutSnapshotJson,
    size: 10,
    uuid: 'uuid-1',
    fileExtension: 'json.gz',
  );

  GestureCollector collectorWith(LayoutSnapshotCollector snapshotCollector) {
    final timeProvider = FlutterTimeProvider(clock);
    return GestureCollector(
      signalProcessor,
      timeProvider,
      snapshotCollector,
      LayoutSnapshotThrottler(timeProvider),
    )..register();
  }

  setUp(() {
    signalProcessor = FakeSignalProcessor();
    clock = TestClock.create();
    collector = collectorWith(FakeLayoutSnapshotCollector(attachment: attachment));
  });

  Future<void> click({int? timestamp}) => collector.trackGestureClick(
        ClickData(
          target: 'Button',
          x: 1,
          y: 1,
          touchDownTime: null,
          touchUpTime: null,
        ),
        snapshot: snapshot,
        timestamp: timestamp,
      );

  Future<void> longClick() => collector.trackGestureLongClick(
        LongClickData(
          target: 'Button',
          x: 1,
          y: 1,
          touchDownTime: null,
          touchUpTime: null,
        ),
        snapshot: snapshot,
      );

  TrackedEvent lastEvent() => signalProcessor.trackedEvents.last;

  group('gesture events', () {
    test('stamps a click at the tap, not when its snapshot finished writing',
        () async {
      collector = collectorWith(_SlowLayoutSnapshotCollector(clock));
      final tapTime = clock.epochTime();

      await click();

      expect(lastEvent().timestamp, equals(tapTime));
    });

    test(
        'stamps a long click at the tap, not when its snapshot finished '
        'writing', () async {
      collector = collectorWith(_SlowLayoutSnapshotCollector(clock));
      final tapTime = clock.epochTime();

      await longClick();

      expect(lastEvent().timestamp, equals(tapTime));
    });

    test('stamps a click at the timestamp the caller supplies', () async {
      final tapTime = clock.epochTime();
      clock.advance(const Duration(milliseconds: 300));

      await click(timestamp: tapTime);

      expect(lastEvent().timestamp, equals(tapTime));
    });

    test('ignores a click while the collector is unregistered', () async {
      collector.unregister();

      await click();

      expect(signalProcessor.trackedEvents, isEmpty);
    });

    test('tracks a scroll, which carries no snapshot', () async {
      collector.trackGestureScroll(ScrollData(
        target: 'ListView',
        x: 1,
        y: 1,
        endX: 1,
        endY: 100,
        touchDownTime: null,
        touchUpTime: null,
        direction: MsrScrollDirection.down,
      ));

      expect(lastEvent().attachments, isNull);
    });
  });

  group('layout snapshots', () {
    test('attaches a snapshot of the screen to the click', () async {
      await click();

      expect(lastEvent().attachments?.single, same(attachment));
    });

    test('tracks a click within the throttle window without a snapshot',
        () async {
      await click();
      clock.advance(const Duration(milliseconds: 500));

      await click();

      expect(lastEvent().attachments, isNull);
    });

    test('attaches a snapshot again once the throttle window has passed',
        () async {
      await click();
      clock.advance(const Duration(milliseconds: 751));

      await click();

      expect(lastEvent().attachments?.single, same(attachment));
    });

    test('throttles a long click against the same window as a click', () async {
      await click();
      clock.advance(const Duration(milliseconds: 500));

      await longClick();

      expect(lastEvent().attachments, isNull);
    });
  });
}

/// Stands in for the real collector, whose json encode, gzip and file write
/// take time the event timestamp must not absorb.
class _SlowLayoutSnapshotCollector implements LayoutSnapshotCollector {
  _SlowLayoutSnapshotCollector(this._clock);

  final TestClock _clock;

  @override
  Future<MsrAttachment?> createAttachment(SnapshotNode snapshot) async {
    _clock.advance(const Duration(milliseconds: 120));
    return null;
  }

  @override
  Future<MsrAttachment?> captureAttachmentAfterNextFrame() async => null;
}
