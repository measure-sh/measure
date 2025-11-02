import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/gestures/snapshot_node.dart';
import 'package:measure_flutter/src/isolate/file_processing_isolate.dart';
import 'package:measure_flutter/src/isolate/file_processor.dart';

import '../utils/noop_logger.dart';
import '../utils/test_png.dart';

void main() {
  group('FileProcessingIsolate', () {
    late FileProcessingIsolate isolate;
    late NoopLogger logger;
    late Directory tempDir;

    setUp(() async {
      logger = NoopLogger();
      isolate = FileProcessingIsolate(logger: logger);
      tempDir = Directory.systemTemp.createTempSync('file_processing_test');
    });

    tearDown(() async {
      await isolate.dispose();
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('initializes successfully', () async {
      await isolate.init();

      // Should be able to process requests after initialization
      final snapshot = SnapshotNode(
        label: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'test.json',
        tempDir.path,
      );

      expect(result.error, isNull);
      expect(result.filePath, isNotNull);
      expect(result.size, greaterThan(0));
    });

    test('init is idempotent', () async {
      await isolate.init();

      // Second call should be no-op
      await isolate.init();

      final snapshot = SnapshotNode(
        label: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'test.json',
        tempDir.path,
      );

      expect(result.error, isNull);
    });

    test('returns error when processing without initialization', () async {
      final snapshot = SnapshotNode(
        label: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'test.json',
        tempDir.path,
      );

      expect(result.error, equals('Isolate not initialized'));
      expect(result.filePath, isNull);
    });

    test('processes layout snapshot write successfully', () async {
      await isolate.init();

      final snapshot = SnapshotNode(
        label: 'Parent',
        x: 10,
        y: 20,
        width: 200,
        height: 300,
        highlighted: true,
        children: [
          SnapshotNode(
            label: 'Child',
            x: 15,
            y: 25,
            width: 50,
            height: 50,
            children: [],
          ),
        ],
      );

      final result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'snapshot.json',
        tempDir.path,
        // Disable compression for easier verification
        compress: false,
      );

      expect(result.error, isNull);
      expect(result.filePath, contains('snapshot.json'));
      expect(result.size, greaterThan(0));

      // Verify file was actually created
      final file = File(result.filePath!);
      expect(file.existsSync(), isTrue);

      // Verify file content is valid
      final content = await file.readAsString();
      expect(content, contains('Parent'));
      expect(content, contains('Child'));
    });

    test('processes image compression successfully', () async {
      await isolate.init();

      final imageBytes = createTestPngBytes();
      final params = CompressAndSaveParams(
        originalBytes: imageBytes,
        jpegQuality: 85,
        fileName: 'test-image.jpg',
        rootPath: tempDir.path,
      );

      final result = await isolate.processImageCompression(params);

      expect(result.error, isNull);
      expect(result.filePath, contains('test-image.jpg'));
      expect(result.size, greaterThan(0));

      // Verify file was created
      final file = File(result.filePath!);
      expect(file.existsSync(), isTrue);
    });

    test('handles multiple concurrent requests', () async {
      await isolate.init();

      final snapshots = List.generate(
        5,
        (i) => SnapshotNode(
          label: 'Widget$i',
          x: i * 10.0,
          y: i * 10.0,
          width: 100,
          height: 100,
          children: [],
        ),
      );

      // Process multiple requests concurrently
      final futures = snapshots
          .asMap()
          .entries
          .map((entry) => isolate.processLayoutSnapshotWrite(
                entry.value,
                'snapshot_${entry.key}.json',
                tempDir.path,
              ))
          .toList();

      final results = await Future.wait(futures);

      // All should succeed
      for (var i = 0; i < results.length; i++) {
        expect(results[i].error, isNull, reason: 'Request $i failed');
        expect(results[i].filePath, isNotNull);
        expect(results[i].size, greaterThan(0));
      }

      // Verify all files were created
      for (var i = 0; i < 5; i++) {
        final file = File('${tempDir.path}/snapshot_$i.json');
        expect(file.existsSync(), isTrue, reason: 'File $i not created');
      }
    });

    test('disposes cleanly', () async {
      await isolate.init();

      await isolate.dispose();

      // Should return error after disposal
      final snapshot = SnapshotNode(
        label: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      final result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'test.json',
        tempDir.path,
      );

      expect(result.error, equals('Isolate not initialized'));
    });

    test('dispose completes pending requests with errors', () async {
      await isolate.init();

      final snapshot = SnapshotNode(
        label: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      // Start a request but dispose before it completes
      final future = isolate.processLayoutSnapshotWrite(
        snapshot,
        'test.json',
        tempDir.path,
      );

      // Dispose immediately (in practice, this will likely complete before disposal,
      // but the test verifies the disposal logic handles pending requests)
      await isolate.dispose();

      final result = await future;

      // Should either succeed (if it completed before disposal) or return disposal error
      expect(
        result.error == null || result.error == 'Isolate disposed before request completed',
        isTrue,
      );
    });

    test('handles invalid file path gracefully', () async {
      await isolate.init();

      final snapshot = SnapshotNode(
        label: 'TestWidget',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      // Use invalid path
      final result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'test.json',
        '/invalid/nonexistent/path',
      );

      // Should return error
      expect(result.error, isNotNull);
    });

    test('can reinitialize after disposal', () async {
      await isolate.init();

      final snapshot = SnapshotNode(
        label: 'Test1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        children: [],
      );

      // First request should succeed
      var result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'test1.json',
        tempDir.path,
      );
      expect(result.error, isNull);

      // Dispose
      await isolate.dispose();

      // Reinitialize
      await isolate.init();

      // Second request should also succeed
      result = await isolate.processLayoutSnapshotWrite(
        snapshot,
        'test2.json',
        tempDir.path,
      );
      expect(result.error, isNull);
      expect(result.filePath, contains('test2.json'));
    });
  });
}
