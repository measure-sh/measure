import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/bug_report/attachment_processing.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/exception/exception_collector.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/exception/exception_framework.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_file_storage.dart';
import '../utils/fake_screenshot_collector.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/noop_logger.dart';
import '../utils/test_clock.dart';

// Mock the isolate function
Future<FileProcessingResult> mockCompressAndSaveInIsolate(CompressAndSaveParams params) async {
  return FileProcessingResult(
    filePath: '/mock/path/screenshot.jpg',
    compressedSize: 1024,
  );
}

void main() {
  group('ExceptionCollector', () {
    late ExceptionCollector collector;
    late NoopLogger logger;
    late FakeSignalProcessor signalProcessor;
    late FakeConfigProvider configProvider;
    late FakeFileStorage fileStorage;
    late FakeScreenshotCollector screenshotCollector;

    setUp(() {
      logger = NoopLogger();
      signalProcessor = FakeSignalProcessor();
      configProvider = FakeConfigProvider();
      fileStorage = FakeFileStorage();
      screenshotCollector = FakeScreenshotCollector();
      collector = ExceptionCollector(
        logger: logger,
        signalProcessor: signalProcessor,
        configProvider: configProvider,
        fileStorage: fileStorage,
        screenshotCollector: screenshotCollector,
        timeProvider: FlutterTimeProvider(TestClock.create()),
        compressAndSave: mockCompressAndSaveInIsolate,
      );
    });

    test('initial state should be disabled', () {
      expect(collector.isEnabled(), false);
    });

    test('registers the collector', () {
      collector.register();
      expect(collector.isEnabled(), true);
    });

    test('unregisters the collector', () {
      collector.register();
      expect(collector.isEnabled(), true);

      collector.unregister();
      expect(collector.isEnabled(), false);
    });

    test('tracks exception with un-obfuscated stacktrace', () {
      final error = Object();
      final stackTrace = StackTrace.fromString([
        '#0      _MyAppState._throwException (package:measure_flutter_example/main.dart:84:5)',
        '#1      _InkResponseState.handleTap (package:flutter/src/material/ink_well.dart:1176:21)',
        '#2     _invoke1 (dart:ui/hooks.dart:330:10)',
      ].join('\n'));
      final exceptionData = ExceptionData(
        exceptions: [
          ExceptionUnit(
            type: "Object",
            message: 'Instance of \'Object\'',
            frames: [
              MsrFrame(
                className: "_MyAppState",
                methodName: "_MyAppState._throwException",
                fileName: "main.dart",
                lineNum: 84,
                colNum: 5,
                moduleName: "package:measure_flutter_example/",
                frameIndex: 0,
              ),
              MsrFrame(
                className: "_InkResponseState",
                methodName: "_InkResponseState.handleTap",
                fileName: "ink_well.dart",
                lineNum: 1176,
                colNum: 21,
                moduleName: "package:flutter/src/material/",
                frameIndex: 1,
              ),
              MsrFrame(
                className: null,
                methodName: "_invoke1",
                fileName: "hooks.dart",
                lineNum: 330,
                colNum: 10,
                moduleName: "dart:ui/",
                frameIndex: 2,
              )
            ],
          ),
        ],
        handled: false,
        threads: [],
        foreground: true,
        binaryImages: [],
        framework: exceptionFramework,
      );

      collector.register();
      collector.trackError(
        FlutterErrorDetails(exception: error, stack: stackTrace),
        handled: false,
        attributes: {},
      );

      expect(signalProcessor.trackedExceptions.length, 1);
      expect(
        signalProcessor.trackedExceptions[0].toJson(),
        exceptionData.toJson(),
        reason: 'Exception data does not match',
      );
    });

    test('tracks exception with obfuscated stacktrace', () {
      final error = Object();
      final stackTrace = StackTrace.fromString('''
*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***
pid: 23117, tid: 529977154736, name 1.ui
os: android arch: arm64 comp: yes sim: no
build_id: '369f5a6f980ba1e36116077ffc3e28e0'
isolate_dso_base: 7af7026000, vm_dso_base: 7af7026000
isolate_instructions: 7af70ecb40, vm_instructions: 7af70d6000
    #00 abs 0000007af71c4903 virt 000000000019e903 _kDartIsolateSnapshotInstructions+0xd7dc3
    #01 abs 0000007af71c48cf virt 000000000019e8cf _kDartIsolateSnapshotInstructions+0xd7d8f
        ''');
      final exceptionData = ExceptionData(
        exceptions: [
          ExceptionUnit(
            type: "Object",
            message: 'Instance of \'Object\'',
            frames: [
              MsrFrame(
                frameIndex: 0,
                instructionAddress: "0x7af71c4903",
              ),
              MsrFrame(
                frameIndex: 1,
                instructionAddress: "0x7af71c48cf",
              ),
            ],
          ),
        ],
        handled: false,
        threads: [],
        foreground: true,
        binaryImages: [
          BinaryImage(
            baseAddr: "7af7026000",
            uuid: "369f5a6f980ba1e36116077ffc3e28e0",
            arch: "arm64",
          )
        ],
        framework: exceptionFramework,
      );

      collector.register();
      collector.trackError(
        FlutterErrorDetails(exception: error, stack: stackTrace),
        handled: false,
        attributes: {},
      );

      expect(signalProcessor.trackedExceptions.length, 1);
      expect(
        signalProcessor.trackedExceptions[0].toJson(),
        exceptionData.toJson(),
        reason: 'Exception data does not match',
      );
    });

    test('tracks exception with screenshot if enabled', () async {
      configProvider.trackScreenshotOnCrash = true;

      final error = Object();
      final stackTrace = StackTrace.fromString([
        '#0      _MyAppState._throwException (package:measure_flutter_example/main.dart:84:5)',
        '#1      _InkResponseState.handleTap (package:flutter/src/material/ink_well.dart:1176:21)',
        '#2     _invoke1 (dart:ui/hooks.dart:330:10)',
      ].join('\n'));
      final exceptionData = ExceptionData(
        exceptions: [
          ExceptionUnit(
            type: "Object",
            message: 'Instance of \'Object\'',
            frames: [
              MsrFrame(
                className: "_MyAppState",
                methodName: "_MyAppState._throwException",
                fileName: "main.dart",
                lineNum: 84,
                colNum: 5,
                moduleName: "package:measure_flutter_example/",
                frameIndex: 0,
              ),
              MsrFrame(
                className: "_InkResponseState",
                methodName: "_InkResponseState.handleTap",
                fileName: "ink_well.dart",
                lineNum: 1176,
                colNum: 21,
                moduleName: "package:flutter/src/material/",
                frameIndex: 1,
              ),
              MsrFrame(
                className: null,
                methodName: "_invoke1",
                fileName: "hooks.dart",
                lineNum: 330,
                colNum: 10,
                moduleName: "dart:ui/",
                frameIndex: 2,
              )
            ],
          ),
        ],
        handled: false,
        threads: [],
        foreground: true,
        binaryImages: [],
        framework: exceptionFramework,
      );

      collector.register();
      await collector.trackError(
        FlutterErrorDetails(exception: error, stack: stackTrace),
        handled: false,
        attributes: {},
      );

      expect(signalProcessor.trackedEvents.length, 1);
      expect(signalProcessor.trackedEvents.first.type, EventType.exception);
      expect(signalProcessor.trackedEvents.first.attachments?.length, 1);
      expect(
        signalProcessor.trackedExceptions[0].toJson(),
        exceptionData.toJson(),
        reason: 'Exception data does not match',
      );
    });

    test('tracks exception with attributes', () async {
      final error = Object();
      final stackTrace = StackTrace.fromString([
        '#0      _MyAppState._throwException (package:measure_flutter_example/main.dart:84:5)',
        '#1      _InkResponseState.handleTap (package:flutter/src/material/ink_well.dart:1176:21)',
        '#2     _invoke1 (dart:ui/hooks.dart:330:10)',
      ].join('\n'));
      final attributes = {"key": StringAttr("value")};

      collector.register();
      collector.trackError(
        FlutterErrorDetails(exception: error, stack: stackTrace),
        handled: false,
        attributes: attributes,
      );

      expect(signalProcessor.trackedExceptions.length, 1);
      expect(
        signalProcessor.trackedEvents[0].userDefinedAttrs,
        attributes,
        reason: 'User defined attributes do not match',
      );
    });
  });
}
