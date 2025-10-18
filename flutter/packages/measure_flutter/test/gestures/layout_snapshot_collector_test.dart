import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/bug_report/attachment_processing.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';

import '../utils/fake_file_processing_isolate.dart';
import '../utils/fake_file_storage.dart';
import '../utils/fake_id_provider.dart';
import '../utils/noop_logger.dart';

void main() {
  group('LayoutSnapshotCollector', () {
    late LayoutSnapshotCollector collector;
    late FakeIdProvider idProvider;
    late FakeFileStorage fileStorage;
    late NoopLogger logger;
    late FakeFileProcessingIsolate fakeWorker;

    setUp(() {
      idProvider = FakeIdProvider();
      fileStorage = FakeFileStorage();
      logger = NoopLogger();
      fakeWorker = FakeFileProcessingIsolate();

      // Initialize the shared worker used by writeJsonToFileInIsolate
      initializeFileProcessingIsolate(fakeWorker);

      collector = LayoutSnapshotCollector(
        logger: logger,
        idProvider: idProvider,
        fileStorage: fileStorage,
      );
    });

    test('creates attachment successfully with valid snapshot', () async {
      final snapshot = LayoutSnapshot(
        widgetName: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await collector.createAttachment(snapshot);

      expect(result, isNotNull);
      expect(result!.type, equals(AttachmentType.layoutSnapshotJson));
      expect(result.id, equals('uuid-1'));
      expect(result.path, contains('uuid-1'));
      expect(result.size, greaterThan(0));
    });

    test('creates attachment with nested children', () async {
      final snapshot = LayoutSnapshot(
        widgetName: 'Parent',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        children: [
          LayoutSnapshot(
            widgetName: 'Child1',
            x: 10,
            y: 10,
            width: 50,
            height: 50,
            children: [],
          ),
          LayoutSnapshot(
            widgetName: 'Child2',
            x: 70,
            y: 70,
            width: 50,
            height: 50,
            id: 'child-2-id',
            highlighted: true,
            children: [],
          ),
        ],
      );

      final result = await collector.createAttachment(snapshot);

      expect(result, isNotNull);
      expect(result!.type, equals(AttachmentType.layoutSnapshotJson));
      expect(result.size, greaterThan(0));
    });

    test('returns null when root path is null', () async {
      fileStorage.shouldReturnNullPath = true;
      final snapshot = LayoutSnapshot(
        widgetName: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await collector.createAttachment(snapshot);

      expect(result, isNull);
    });

    test('returns null when file writing fails', () async {
      fakeWorker.shouldReturnError = true;
      final snapshot = LayoutSnapshot(
        widgetName: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await collector.createAttachment(snapshot);

      expect(result, isNull);
    });

    test('handles exceptions gracefully', () async {
      fakeWorker.shouldThrowException = true;
      final snapshot = LayoutSnapshot(
        widgetName: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await collector.createAttachment(snapshot);

      expect(result, isNull);
    });

    test('generates unique IDs for multiple attachments', () async {
      final snapshot1 = LayoutSnapshot(
        widgetName: 'Widget1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );
      final snapshot2 = LayoutSnapshot(
        widgetName: 'Widget2',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result1 = await collector.createAttachment(snapshot1);
      final result2 = await collector.createAttachment(snapshot2);

      expect(result1, isNotNull);
      expect(result2, isNotNull);
      expect(result1!.id, equals('uuid-1'));
      expect(result2!.id, equals('uuid-2'));
      expect(result1.id, isNot(equals(result2.id)));
    });
  });
}
