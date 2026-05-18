import 'dart:io';

import 'package:flutter/material.dart';
import 'package:measure_flutter/src/bug_report/shake_detector.dart';
import 'package:measure_flutter/src/bug_report/ui/bug_report.dart';
import 'package:measure_flutter/src/bug_report/ui/image_picker.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import '../../measure_flutter.dart';
import '../logger/logger.dart';
import '../storage/file_storage.dart';
import 'bug_report_data.dart';

class BugReportCollector {
  final Logger _logger;
  final ConfigProvider _configProvider;
  final SignalProcessor _signalProcessor;
  final IdProvider _idProvider;
  final FileStorage _fileStorage;
  final ShakeDetector _shakeDetector;
  final TimeProvider _timeProvider;
  final MsrMethodChannel _methodChannel;
  bool isEnabled = false;

  BugReportCollector({
    required Logger logger,
    required ConfigProvider configProvider,
    required SignalProcessor signalProcessor,
    required IdProvider idProvider,
    required FileStorage fileStorage,
    required ShakeDetector shakeDetector,
    required TimeProvider timeProvider,
    required MsrMethodChannel methodChannel,
  })  : _logger = logger,
        _configProvider = configProvider,
        _signalProcessor = signalProcessor,
        _idProvider = idProvider,
        _fileStorage = fileStorage,
        _shakeDetector = shakeDetector,
        _timeProvider = timeProvider,
        _methodChannel = methodChannel;

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

        final File? file;
        final int sizeBytes;
        if (attachment.hasRawPixels) {
          final webp = await _methodChannel.encodeWebP(
            pixels: bytes,
            width: attachment.width!,
            height: attachment.height!,
          );
          if (webp == null) {
            _logger.log(LogLevel.error, 'BugReportCollector: WebP encoding failed');
            continue;
          }
          file = await _fileStorage.writeFile(webp, uuid);
          sizeBytes = webp.length;
        } else {
          file = await _fileStorage.writeFile(bytes, uuid);
          sizeBytes = bytes.length;
        }

        if (file == null) {
          _logger.log(LogLevel.error, 'BugReportCollector: Failed to write attachment');
          continue;
        }

        _logger.log(
          LogLevel.debug,
          'BugReportCollector: Successfully stored screenshot attachment (id: $uuid, size: $sizeBytes bytes, path: ${file.path})',
        );
        storedAttachments.add(
          MsrAttachment(
            name: uuid,
            path: file.path,
            type: attachment.type,
            id: uuid,
            size: sizeBytes,
            bytes: null,
          ),
        );
      }

      _logger.log(LogLevel.debug,
          "BugReportCollector: Processed ${attachments.length} attachments for bug_report");

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
