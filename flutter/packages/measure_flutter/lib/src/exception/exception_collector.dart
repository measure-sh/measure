import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/exception/exception_factory.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/screenshot/screenshot_collector.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../bug_report/attachment_processing.dart';
import '../events/event_type.dart';
import '../storage/file_storage.dart';

final class ExceptionCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  final ConfigProvider configProvider;
  final FileStorage fileStorage;
  final ScreenshotCollector screenshotCollector;
  final Future<FileProcessingResult> Function(CompressAndSaveParams)
      compressAndSave;
  final TimeProvider timeProvider;
  bool _enabled = false;

  ExceptionCollector({
    required this.logger,
    required this.signalProcessor,
    required this.configProvider,
    required this.fileStorage,
    required this.screenshotCollector,
    required this.timeProvider,
    this.compressAndSave = compressAndSaveInIsolate,
  });

  void register() {
    _enabled = true;
  }

  void unregister() {
    _enabled = false;
  }

  Future<void> trackError(
    FlutterErrorDetails details, {
    required bool handled,
  }) async {
    if (!_enabled) return;
    final ExceptionData? exceptionData =
        ExceptionFactory.from(details, handled);
    if (exceptionData == null) {
      logger.log(LogLevel.error, "Failed to parse exception");
      return;
    }

    final attachments = <MsrAttachment>[];
    if (configProvider.trackScreenshotOnCrash && !handled) {
      await _addScreenshot(attachments);
    }

    return signalProcessor.trackEvent(
      data: exceptionData,
      type: EventType.exception,
      timestamp: timeProvider.now(),
      userDefinedAttrs: {},
      userTriggered: false,
      threadName: Isolate.current.debugName,
      attachments: attachments,
    );
  }

  @visibleForTesting
  bool isEnabled() {
    return _enabled;
  }

  Future<void> _addScreenshot(List<MsrAttachment> attachments) async {
    final rootPath = await fileStorage.getRootPath();

    if (rootPath == null) {
      return;
    }

    final screenshot = await screenshotCollector.capture();

    if (screenshot != null && screenshot.bytes != null) {
      final result = await compressAndSave(
        CompressAndSaveParams(
          originalBytes: screenshot.bytes!,
          jpegQuality: configProvider.screenshotCompressionQuality,
          fileName: screenshot.id,
          rootPath: rootPath,
        ),
      );

      final filePath = result.filePath;
      final compressedSize = result.compressedSize;
      if (filePath != null && compressedSize != null) {
        attachments.add(
          MsrAttachment(
            name: screenshot.id,
            path: filePath,
            type: AttachmentType.screenshot,
            id: screenshot.id,
            size: compressedSize,
            bytes: null,
          ),
        );
      }
    }
  }
}
