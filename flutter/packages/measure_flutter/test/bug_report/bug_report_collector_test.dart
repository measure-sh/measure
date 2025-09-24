import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/bug_report/bug_report_collector.dart';
import 'package:measure_flutter/src/bug_report/bug_report_data.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_file_storage.dart';
import '../utils/fake_id_provider.dart';
import '../utils/fake_shake_detector.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/noop_logger.dart';
import '../utils/test_png.dart';
import '../utils/test_clock.dart';

void main() {
  group('BugReportCollector', () {
    late BugReportCollector collector;
    late FakeSignalProcessor signalProcessor;
    late FakeIdProvider idProvider;
    late FakeFileStorage fileStorage;
    late NoopLogger logger;
    late ConfigProvider configProvider;
    late FakeShakeDetector shakeDetector;
    late TimeProvider timeProvider;

    setUp(() {
      signalProcessor = FakeSignalProcessor();
      idProvider = FakeIdProvider();
      fileStorage = FakeFileStorage();
      logger = NoopLogger();
      configProvider = FakeConfigProvider();
      shakeDetector = FakeShakeDetector();
      timeProvider = FlutterTimeProvider(TestClock.create());
      collector = BugReportCollector(
        logger: logger,
        configProvider: configProvider,
        signalProcessor: signalProcessor,
        idProvider: idProvider,
        fileStorage: fileStorage,
        shakeDetector: shakeDetector,
        timeProvider: timeProvider,
      );
      // Enable the collector for all tests
      collector.register();
    });

    test('tracks bug report with description only', () async {
      const description = 'Test bug description';
      final attributes = <String, AttributeValue>{'key': StringAttr('value')};

      await collector.trackBugReport(description, [], attributes);

      expect(signalProcessor.trackedEvents.length, equals(1));
      final event = signalProcessor.trackedEvents.first;
      expect(event.data, isA<BugReportData>());
      expect((event.data as BugReportData).description, equals(description));
      expect(event.type, equals(EventType.bugReport));
      expect(event.userTriggered, isTrue);
      expect(event.userDefinedAttrs, equals(attributes));
      expect(event.attachments, isEmpty);
    });

    test('tracks bug report with attachments', () async {
      const description = 'Test bug with attachments';
      final attachmentBytes = createTestPngBytes();
      final attachments = <MsrAttachment>[
        MsrAttachment(
          name: 'test.png',
          id: 'test-id',
          size: attachmentBytes.length,
          bytes: attachmentBytes,
          type: AttachmentType.screenshot,
        ),
      ];

      await collector.trackBugReport(description, attachments, {});

      expect(signalProcessor.trackedEvents.length, equals(1));
      final event = signalProcessor.trackedEvents.first;
      if (event.attachments?.isNotEmpty == true) {
        final storedAttachment = event.attachments!.first;
        expect(storedAttachment.name, equals('uuid-1'));
        expect(storedAttachment.id, equals('uuid-1'));
        expect(storedAttachment.path, contains('uuid-1'));
        expect(storedAttachment.type, equals(AttachmentType.screenshot));
        expect(storedAttachment.bytes, isNull);

        // Check if file was created
        final file = File(storedAttachment.path!);
        expect(file.existsSync(), isTrue);

        // Clean up
        if (file.existsSync()) {
          file.deleteSync();
        }
      }
    });

    test('skips attachments without bytes', () async {
      const description = 'Test bug with null attachment';
      final attachments = <MsrAttachment>[
        MsrAttachment(
          name: 'empty.png',
          id: 'empty-id',
          size: 0,
          bytes: null,
          type: AttachmentType.screenshot,
        ),
      ];

      await collector.trackBugReport(description, attachments, {});

      expect(signalProcessor.trackedEvents.length, equals(1));
      final event = signalProcessor.trackedEvents.first;
      expect(event.attachments, isEmpty);
      expect(fileStorage.storedFileCount, equals(0));
    });

    test('handles file storage failure gracefully', () async {
      const description = 'Test bug with storage failure';
      final attachmentBytes = createTestPngBytes();
      final attachments = <MsrAttachment>[
        MsrAttachment(
          name: 'test.png',
          id: 'test-id',
          size: attachmentBytes.length,
          bytes: attachmentBytes,
          type: AttachmentType.screenshot,
        ),
      ];
      fileStorage.shouldFailWrite = true;

      await collector.trackBugReport(description, attachments, {});

      expect(signalProcessor.trackedEvents.length, equals(1));
      final event = signalProcessor.trackedEvents.first;
      expect(event.attachments, isEmpty);
    });

    test('processes multiple attachments correctly', () async {
      const description = 'Test bug with multiple attachments';
      final attachment1Bytes = createTestPngBytes();
      final attachment2Bytes = createTestPngBytes();
      final attachments = <MsrAttachment>[
        MsrAttachment(
          name: 'test1.png',
          id: 'test1-id',
          size: attachment1Bytes.length,
          bytes: attachment1Bytes,
          type: AttachmentType.screenshot,
        ),
        MsrAttachment(
          name: 'test2.png',
          id: 'test2-id',
          size: attachment2Bytes.length,
          bytes: attachment2Bytes,
          type: AttachmentType.screenshot,
        ),
      ];

      await collector.trackBugReport(description, attachments, {});

      expect(signalProcessor.trackedEvents.length, equals(1));
      final event = signalProcessor.trackedEvents.first;
      final createdFiles = <File>[];
      if (event.attachments?.isNotEmpty == true) {
        expect(event.attachments!.length, equals(2));

        for (int i = 0; i < event.attachments!.length; i++) {
          final attachment = event.attachments![i];
          expect(attachment.name, equals('uuid-${i + 1}'));
          expect(attachment.path, contains('uuid-${i + 1}'));

          final file = File(attachment.path!);
          expect(file.existsSync(), isTrue);
          createdFiles.add(file);
        }
      }

      // Clean up
      for (final file in createdFiles) {
        if (file.existsSync()) {
          file.deleteSync();
        }
      }
    });

    test('continues processing when some attachments fail to store', () async {
      const description = 'Test partial attachment failure';
      final attachment1Bytes = createTestPngBytes();
      final attachment2Bytes = createTestPngBytes();
      final attachments = <MsrAttachment>[
        MsrAttachment(
          name: 'test1.png',
          id: 'test1-id',
          size: attachment1Bytes.length,
          bytes: attachment1Bytes,
          type: AttachmentType.screenshot,
        ),
        MsrAttachment(
          name: 'test2.png',
          id: 'test2-id',
          size: attachment2Bytes.length,
          bytes: attachment2Bytes,
          type: AttachmentType.screenshot,
        ),
      ];

      // Make second write fail
      fileStorage.shouldFailWriteAfterCount = 1;

      await collector.trackBugReport(description, attachments, {});

      expect(signalProcessor.trackedEvents.length, equals(1));
      final event = signalProcessor.trackedEvents.first;

      // Clean up any created files
      if (event.attachments?.isNotEmpty == true) {
        for (final attachment in event.attachments!) {
          final file = File(attachment.path!);
          if (file.existsSync()) {
            file.deleteSync();
          }
        }
      }
    });

    test('tracks bug report with attachment from file path', () async {
      const description = 'Test bug with path-based attachment';
      final attachmentBytes = createTestPngBytes();
      // Create a temporary file
      final tempDir = Directory.systemTemp.createTempSync('bug_report_test');
      final tempFile = File('${tempDir.path}/test_image.png');
      await tempFile.writeAsBytes(attachmentBytes);

      final attachments = <MsrAttachment>[
        MsrAttachment(
          name: 'test_image.png',
          id: 'path-test-id',
          size: attachmentBytes.length,
          path: tempFile.path,
          bytes: null,
          // No bytes, should read from path
          type: AttachmentType.screenshot,
        ),
      ];

      await collector.trackBugReport(description, attachments, {});

      expect(signalProcessor.trackedEvents.length, equals(1));
      final event = signalProcessor.trackedEvents.first;

      if (event.attachments?.isNotEmpty == true) {
        final storedAttachment = event.attachments!.first;
        expect(storedAttachment.name, equals('uuid-1'));
        expect(storedAttachment.id, equals('uuid-1'));
        expect(storedAttachment.path, contains('uuid-1'));
        expect(storedAttachment.type, equals(AttachmentType.screenshot));
        expect(storedAttachment.bytes, isNull);

        // Check if processed file was created
        final processedFile = File(storedAttachment.path!);
        expect(processedFile.existsSync(), isTrue);

        // Clean up processed file
        if (processedFile.existsSync()) {
          processedFile.deleteSync();
        }
      }

      // Clean up temp file and directory
      if (tempFile.existsSync()) {
        tempFile.deleteSync();
      }
      if (tempDir.existsSync()) {
        tempDir.deleteSync();
      }
    });
  });
}
