import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
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

  final snapshotAttachment = MsrAttachment.fromPath(
    path: 'snapshot-path',
    type: AttachmentType.layoutSnapshotJson,
    size: 10,
    uuid: 'uuid-1',
    fileExtension: 'json.gz',
  );

  setUp(() {
    signalProcessor = FakeSignalProcessor();
    timeProvider = FlutterTimeProvider(TestClock.create());
    snapshotCollector = FakeLayoutSnapshotCollector(
      attachment: snapshotAttachment,
    );
    collector = NavigationCollector(
      signalProcessor: signalProcessor,
      timeProvider: timeProvider,
      layoutSnapshotCollector: snapshotCollector,
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
