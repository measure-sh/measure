import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

/// A global key used by a [RepaintBoundary] in [MeasureWidget] to allow
/// taking screenshots.
final GlobalKey screenshotKey = GlobalKey();

/// Captures screenshots of Flutter widget, stores it as a File and returns
/// a [MsrAttachment]. Must be used along with [MeasureWidget].
class ScreenshotService {
  static Future<MsrAttachment?> capture(
    Logger logger,
    IdProvider idProvider,
    ConfigProvider configProvider,
  ) async {
    try {
      final renderObject = screenshotKey.currentContext?.findRenderObject();
      if (renderObject == null || renderObject is! RenderRepaintBoundary) {
        logger.log(
          LogLevel.debug,
          'ScreenshotService: Invalid render object or not a RepaintBoundary',
        );
        return null;
      }

      final ui.Image image = await renderObject.toImage(pixelRatio: 1);
      final png = await image.toByteData(format: ui.ImageByteFormat.png);

      if (png == null) {
        logger.log(
          LogLevel.debug,
          'ScreenshotService: Error reading image as PNG',
        );
        return null;
      }

      return MsrAttachment.fromBytes(
        bytes: png.buffer.asUint8List(),
        type: AttachmentType.screenshot,
        uuid: idProvider.uuid(),
      );
    } catch (e) {
      logger.log(
        LogLevel.debug,
        'ScreenshotService: Error capturing screenshot: $e',
      );
      return null;
    }
  }
}
