import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';
import 'package:measure_flutter/src/isolate/file_processor.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_file_processing_isolate.dart';
import '../utils/fake_file_storage.dart';
import '../utils/fake_id_provider.dart';
import '../utils/measure_test_app.dart';
import '../utils/noop_logger.dart';

void main() {
  late LayoutSnapshotCollector collector;
  late FakeIdProvider idProvider;
  late FakeFileStorage fileStorage;
  late NoopLogger logger;
  late FakeFileProcessingIsolate worker;

  final snapshot = SnapshotNode(
    label: 'Parent',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    children: [
      SnapshotNode(
        label: 'Child',
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        highlighted: true,
        children: [],
      ),
    ],
  );

  setUp(() {
    idProvider = FakeIdProvider();
    fileStorage = FakeFileStorage();
    logger = NoopLogger();
    worker = FakeFileProcessingIsolate();
    initializeFileProcessingIsolate(worker);
    collector = LayoutSnapshotCollector(
      FakeConfigProvider(),
      fileStorage,
      logger,
      idProvider,
    );
  });

  group('createAttachment', () {
    test('names the compressed snapshot after its id', () async {
      final result = await collector.createAttachment(snapshot);

      expect(result, isNotNull);
      expect(result!.type, equals(AttachmentType.layoutSnapshotJson));
      expect(result.name, equals('${result.id}.json.gz'));
      expect(result.path, contains(result.id));
      expect(result.size, greaterThan(0));
    });

    test('gives every attachment its own id', () async {
      final first = await collector.createAttachment(snapshot);
      final second = await collector.createAttachment(snapshot);

      expect(first!.id, isNot(equals(second!.id)));
    });

    // Storing a snapshot reaches the file system through an isolate, and no
    // failure along the way may reach the app.
    final failures = <String, void Function()>{
      'the storage root is unavailable': () =>
          fileStorage.shouldReturnNullPath = true,
      'the write reports an error': () => worker.shouldReturnError = true,
      'the write throws': () => worker.shouldThrowException = true,
    };
    failures.forEach((cause, arrange) {
      test('returns null when $cause', () async {
        arrange();

        expect(await collector.createAttachment(snapshot), isNull);
      });
    });
  });

  group('captureAttachmentAfterNextFrame', () {
    testWidgets('captures the screen once a frame has been rendered',
        (tester) async {
      final future = collector.captureAttachmentAfterNextFrame();
      await tester.pumpWidget(measureApp(child: const Text('Home')));

      final result = await future;

      expect(result, isNotNull);
      expect(result!.type, equals(AttachmentType.layoutSnapshotJson));
    });

    testWidgets('returns null when reading the widget tree throws',
        (tester) async {
      final failing = LayoutSnapshotCollector(
        _ThrowingConfigProvider(),
        fileStorage,
        logger,
        idProvider,
      );

      final future = failing.captureAttachmentAfterNextFrame();
      await tester.pumpWidget(measureApp(child: const Text('Home')));

      expect(await future, isNull);
    });
  });
}

class _ThrowingConfigProvider extends FakeConfigProvider {
  @override
  Map<Type, String> get widgetFilter => throw StateError('capture failed');
}
