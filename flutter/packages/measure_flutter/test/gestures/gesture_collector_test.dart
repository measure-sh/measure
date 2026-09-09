import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/click_data.dart';
import 'package:measure_flutter/src/gestures/gesture_collector.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_throttler.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_layout_snapshot_collector.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/test_clock.dart';

void main() {
  group('GestureCollector', () {
    late FakeSignalProcessor signalProcessor;
    late TestClock clock;
    late GestureCollector collector;
    late _SlowLayoutSnapshotCollector snapshotCollector;

    final snapshot = SnapshotNode(
      label: 'Button',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      children: [],
    );

    setUp(() {
      signalProcessor = FakeSignalProcessor();
      clock = TestClock.create();
      snapshotCollector = _SlowLayoutSnapshotCollector(clock);
      collector = GestureCollector(
        signalProcessor,
        FlutterTimeProvider(clock),
        snapshotCollector,
        LayoutSnapshotThrottler(FlutterTimeProvider(clock)),
      );
      collector.register();
    });

    test('stamps a click at the gesture, not after the snapshot is written',
        () async {
      final tapTime = clock.epochTime();

      await collector.trackGestureClick(
        ClickData(
          target: 'Button',
          x: 1,
          y: 1,
          touchDownTime: null,
          touchUpTime: null,
        ),
        snapshot: snapshot,
      );

      expect(signalProcessor.trackedEvents.single.timestamp, equals(tapTime));
    });

    test('stamps a long click at the gesture, not after the snapshot is '
        'written', () async {
      final tapTime = clock.epochTime();

      await collector.trackGestureLongClick(
        LongClickData(
          target: 'Button',
          x: 1,
          y: 1,
          touchDownTime: null,
          touchUpTime: null,
        ),
        snapshot: snapshot,
      );

      expect(signalProcessor.trackedEvents.single.timestamp, equals(tapTime));
    });

    test('keeps the timestamp the caller supplies', () async {
      await collector.trackGestureClick(
        ClickData(
          target: 'Button',
          x: 1,
          y: 1,
          touchDownTime: null,
          touchUpTime: null,
        ),
        snapshot: snapshot,
        timestamp: 42,
      );

      expect(signalProcessor.trackedEvents.single.timestamp, equals(42));
    });
  });

  group('GestureCollector layout snapshot throttling', () {
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

    Future<void> click() => collector.trackGestureClick(
          ClickData(
            target: 'Button',
            x: 1,
            y: 1,
            touchDownTime: null,
            touchUpTime: null,
          ),
          snapshot: snapshot,
        );

    setUp(() {
      signalProcessor = FakeSignalProcessor();
      clock = TestClock.create();
      collector = GestureCollector(
        signalProcessor,
        FlutterTimeProvider(clock),
        FakeLayoutSnapshotCollector(attachment: attachment),
        LayoutSnapshotThrottler(FlutterTimeProvider(clock)),
      );
      collector.register();
    });

    test('attaches a snapshot to the first click', () async {
      await click();

      expect(signalProcessor.trackedEvents.single.attachments?.single,
          same(attachment));
    });

    test('leaves out the snapshot of a click within the delay', () async {
      await click();
      clock.advance(const Duration(milliseconds: 500));

      await click();

      expect(signalProcessor.trackedEvents.last.attachments, isNull);
    });

    test('attaches a snapshot again once the delay has elapsed', () async {
      await click();
      clock.advance(const Duration(milliseconds: 751));

      await click();

      expect(signalProcessor.trackedEvents.last.attachments?.single,
          same(attachment));
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
