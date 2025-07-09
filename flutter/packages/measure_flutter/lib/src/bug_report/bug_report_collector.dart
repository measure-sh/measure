import 'dart:io';

import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/shake_detector.dart';
import 'package:measure_flutter/src/bug_report/ui/bug_report.dart';
import 'package:measure_flutter/src/bug_report/ui/image_picker.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import '../../measure.dart';
import '../logger/logger.dart';
import '../storage/file_storage.dart';
import 'attachment_processing.dart';
import 'bug_report_data.dart';

class BugReportCollector {
  final Logger _logger;
  final ConfigProvider _configProvider;
  final SignalProcessor _signalProcessor;
  final IdProvider _idProvider;
  final FileStorage _fileStorage;
  final ShakeDetector _shakeDetector;
  final TimeProvider _timeProvider;
  bool isEnabled = false;

  BugReportCollector({
    required Logger logger,
    required ConfigProvider configProvider,
    required SignalProcessor signalProcessor,
    required IdProvider idProvider,
    required FileStorage fileStorage,
    required ShakeDetector shakeDetector,
    required TimeProvider timeProvider,
  })  : _logger = logger,
        _configProvider = configProvider,
        _signalProcessor = signalProcessor,
        _idProvider = idProvider,
        _fileStorage = fileStorage,
        _shakeDetector = shakeDetector,
        _timeProvider = timeProvider;

  void register() {
    isEnabled = true;
  }

  void unregister() {
    isEnabled = false;
  }

  Future<void> trackBugReport(
      String description,
      List<MsrAttachment> attachments,
      Map<String, AttributeValue> attributes) async {
    if (!isEnabled) return;
    try {
      final storedAttachments = <MsrAttachment>[];

      // Get root path once before processing
      final rootPath = await _fileStorage.getRootPath();

      if (rootPath == null) {
        _logger.log(LogLevel.error, "Root path is null");
        return;
      }

      for (var attachment in attachments) {
        final path = attachment.path;
        var bytes = attachment.bytes;
        if (bytes == null && path != null) {
          bytes = await File(path).readAsBytes();
        }
        if (bytes == null) {
          _logger.log(LogLevel.error, "Failed to read attachment bytes");
          continue;
        }

        final uuid = _idProvider.uuid();
        final result = await compressAndSaveInIsolate(
          CompressAndSaveParams(
            originalBytes: bytes,
            jpegQuality: _configProvider.screenshotCompressionQuality,
            fileName: uuid,
            rootPath: rootPath,
          ),
        );

        final filePath = result.filePath;
        final compressedSize = result.compressedSize;
        if (filePath != null && compressedSize != null) {
          storedAttachments.add(
            MsrAttachment(
              name: uuid,
              path: filePath,
              type: AttachmentType.screenshot,
              id: uuid,
              size: compressedSize,
              bytes: null,
            ),
          );
        } else {
          _logger.log(LogLevel.error, "Failed to process attachment");
        }
      }

      _logger.log(LogLevel.debug,
          "Processed ${attachments.length} attachments for bug_report");

      final data = BugReportData(description: description);
      _signalProcessor.trackEvent(
        data: data,
        type: EventType.bugReport,
        timestamp: _timeProvider.now(),
        userDefinedAttrs: attributes,
        userTriggered: true,
        attachments: storedAttachments,
      );
    } catch (e, stacktrace) {
      _logger.log(LogLevel.error, 'Error tracking bug report', e, stacktrace);
    }
  }

  Widget createBugReport({
    Key? key,
    MsrAttachment? screenshot,
    required Map<String, AttributeValue>? attributes,
    required BugReportTheme theme,
  }) {
    if (!isEnabled) return SizedBox.shrink();
    return BugReport(
      key: key,
      initialScreenshot: screenshot,
      theme: theme,
      logger: _logger,
      configProvider: _configProvider,
      idProvider: _idProvider,
      imagePicker: ImagePickerWrapper(idProvider: _idProvider, logger: _logger),
      shakeDetector: _shakeDetector,
      attributes: attributes,
    );
  }
}
