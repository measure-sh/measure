import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_throttler.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';
import 'package:measure_flutter/src/navigation/screen_view_data.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_layout_snapshot_collector.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/test_clock.dart';

void main() {
  late FakeSignalProcessor signalProcessor;
  late NavigationCollector collector;
  late TimeProvider timeProvider;
  late FakeLayoutSnapshotCollector snapshotCollector;
  late TestClock clock;

  final snapshotAttachment = MsrAttachment.fromPath(
    path: 'snapshot-path',
    type: AttachmentType.layoutSnapshotJson,
    size: 10,
    uuid: 'uuid-1',
    fileExtension: 'json.gz',
  );

  setUp(() {
    signalProcessor = FakeSignalProcessor();
    clock = TestClock.create();
    timeProvider = FlutterTimeProvider(clock);
    snapshotCollector = FakeLayoutSnapshotCollector(
      attachment: snapshotAttachment,
    );
    collector = NavigationCollector(
      signalProcessor: signalProcessor,
      timeProvider: timeProvider,
      layoutSnapshotCollector: snapshotCollector,
      layoutSnapshotThrottler: LayoutSnapshotThrottler(timeProvider),
    );
    collector.register();
  });

  TrackedEvent trackedEvent() => signalProcessor.trackedEvents.single;

  group('trackScreenViewEvent', () {
    test('tracks the screen with its attributes, at the time of the call',
        () async {
      final attributes = {'key': StringAttr('value')};

      await collector.trackScreenViewEvent(
        name: 'HomeScreen',
        userTriggered: true,
        attributes: attributes,
      );

      expect((trackedEvent().data as ScreenViewData).name, equals('HomeScreen'));
      expect(trackedEvent().userTriggered, isTrue);
      expect(trackedEvent().userDefinedAttrs, equals(attributes));
      expect(trackedEvent().timestamp, equals(timeProvider.now()));
    });

    test('attaches the layout snapshot', () async {
      await collector.trackScreenViewEvent(
        name: 'HomeScreen',
        userTriggered: false,
        attributes: {},
      );

      expect(trackedEvent().attachments?.single, same(snapshotAttachment));
    });

    test('captures no snapshot when asked not to', () async {
      await collector.trackScreenViewEvent(
        name: 'HomeScreen',
        userTriggered: true,
        attributes: {},
        captureLayoutSnapshot: false,
      );

      expect(snapshotCollector.captureCount, equals(0));
      expect(trackedEvent().attachments, isNull);
    });

    test('leaves out the snapshot of a screen view within the delay', () async {
      await collector.trackScreenViewEvent(
        name: 'HomeScreen',
        userTriggered: false,
        attributes: {},
      );
      clock.advance(const Duration(milliseconds: 500));

      await collector.trackScreenViewEvent(
        name: 'CheckoutScreen',
        userTriggered: false,
        attributes: {},
      );

      expect(signalProcessor.trackedEvents.last.attachments, isNull);
    });

    test('attaches a snapshot again once the delay has elapsed', () async {
      await collector.trackScreenViewEvent(
        name: 'HomeScreen',
        userTriggered: false,
        attributes: {},
      );
      clock.advance(const Duration(milliseconds: 751));

      await collector.trackScreenViewEvent(
        name: 'CheckoutScreen',
        userTriggered: false,
        attributes: {},
      );

      expect(signalProcessor.trackedEvents.last.attachments?.single,
          same(snapshotAttachment));
    });

    test('does nothing while unregistered', () async {
      collector.unregister();

      await collector.trackScreenViewEvent(
        name: 'HomeScreen',
        userTriggered: true,
        attributes: {},
      );

      expect(signalProcessor.trackedEvents, isEmpty);
    });
  });
}
