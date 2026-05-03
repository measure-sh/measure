import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/exception/exception_factory.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/screenshot/screenshot_collector.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../events/event_type.dart';
import '../storage/file_storage.dart';

final class ExceptionCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  final ConfigProvider configProvider;
  final FileStorage fileStorage;
  final ScreenshotCollector screenshotCollector;
  final TimeProvider timeProvider;
  final MsrMethodChannel methodChannel;
  bool _enabled = false;

  ExceptionCollector({
    required this.logger,
    required this.signalProcessor,
    required this.configProvider,
    required this.fileStorage,
    required this.screenshotCollector,
    required this.timeProvider,
    required this.methodChannel,
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
    required Map<String, AttributeValue> attributes,
  }) async {
    if (!_enabled) return;
    final ExceptionData? exceptionData = ExceptionFactory.from(details, handled);
    if (exceptionData == null) {
      logger.log(LogLevel.error, "Failed to parse exception");
      return;
    }

    final attachments = <MsrAttachment>[];

    if (configProvider.crashTakeScreenshot && !handled) {
      await _addScreenshot(attachments);
    }

    return signalProcessor.trackEvent(
      data: exceptionData,
      type: EventType.exception,
      timestamp: timeProvider.now(),
      userDefinedAttrs: attributes,
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
    final screenshot = await screenshotCollector.capture();
    final width = screenshot?.width;
    final height = screenshot?.height;
    if (screenshot == null || screenshot.bytes == null || width == null || height == null) {
      return;
    }

    final webp = await methodChannel.encodeWebP(
      pixels: screenshot.bytes!,
      width: width,
      height: height,
    );
    if (webp == null) {
      logger.log(LogLevel.debug, 'ExceptionCollector: WebP encoding failed');
      return;
    }
    final file = await fileStorage.writeFile(webp, screenshot.id);
    if (file == null) return;

    logger.log(
      LogLevel.debug,
      'ExceptionCollector: Successfully stored screenshot attachment (id: ${screenshot.id}, size: ${webp.length} bytes, path: ${file.path})',
    );
    attachments.add(
      MsrAttachment(
        name: screenshot.id,
        path: file.path,
        type: AttachmentType.screenshot,
        id: screenshot.id,
        size: webp.length,
        bytes: null,
      ),
    );
  }
}
