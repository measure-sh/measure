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

  Future<void> trackScreenView(
    String name, {
    bool userTriggered = false,
    Map<String, AttributeValue> attributes = const {},
    int? timestamp,
    bool captureLayoutSnapshot = true,
  }) =>
      collector.trackScreenViewEvent(
        name: name,
        userTriggered: userTriggered,
        attributes: attributes,
        timestamp: timestamp,
        captureLayoutSnapshot: captureLayoutSnapshot,
      );

  TrackedEvent lastEvent() => signalProcessor.trackedEvents.last;

  String screenName(TrackedEvent event) => (event.data as ScreenViewData).name;

  group('screen views', () {
    test('tracks the screen name, its attributes and who triggered it',
        () async {
      final attributes = {'key': StringAttr('value')};

      await trackScreenView(
        'HomeScreen',
        userTriggered: true,
        attributes: attributes,
      );

      expect(screenName(lastEvent()), equals('HomeScreen'));
      expect(lastEvent().userTriggered, isTrue);
      expect(lastEvent().userDefinedAttrs, equals(attributes));
    });

    test('stamps the screen view at the time it is tracked', () async {
      await trackScreenView('HomeScreen');

      expect(lastEvent().timestamp, equals(clock.epochTime()));
    });

    test('stamps the screen view at the timestamp the caller supplies',
        () async {
      final navigatedAt = clock.epochTime();
      clock.advance(const Duration(milliseconds: 300));

      await trackScreenView('HomeScreen', timestamp: navigatedAt);

      expect(lastEvent().timestamp, equals(navigatedAt));
    });

    test('ignores a screen view while the collector is unregistered', () async {
      collector.unregister();

      await trackScreenView('HomeScreen');

      expect(signalProcessor.trackedEvents, isEmpty);
    });
  });

  group('layout snapshots', () {
    test('attaches a snapshot of the screen to the screen view', () async {
      await trackScreenView('HomeScreen');

      expect(lastEvent().attachments?.single, same(snapshotAttachment));
    });

    test('captures no snapshot when the caller opts out', () async {
      await trackScreenView('HomeScreen', captureLayoutSnapshot: false);

      expect(lastEvent().attachments, isNull);
      expect(snapshotCollector.captureCount, isZero);
    });

    test('tracks a screen view within the throttle window without a snapshot',
        () async {
      await trackScreenView('HomeScreen');
      clock.advance(const Duration(milliseconds: 500));

      await trackScreenView('CheckoutScreen');

      expect(screenName(lastEvent()), equals('CheckoutScreen'));
      expect(lastEvent().attachments, isNull);
      expect(snapshotCollector.captureCount, equals(1));
    });

    test('attaches a snapshot again once the throttle window has passed',
        () async {
      await trackScreenView('HomeScreen');
      clock.advance(const Duration(milliseconds: 751));

      await trackScreenView('CheckoutScreen');

      expect(lastEvent().attachments?.single, same(snapshotAttachment));
    });
  });
}
