import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:image/image.dart' as img;
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import '../storage/file_storage.dart';

/// A global key used by a [RepaintBoundary] in [MeasureWidget] to allow
/// taking screenshots.
final GlobalKey screenshotKey = GlobalKey();

/// Captures screenshots of Flutter widget, stores it as a File and returns
/// a [MsrAttachment]. Must be used along with [MeasureWidget].
class ScreenshotHelper {
  static Future<MsrAttachment?> captureAndStore(
      Logger logger, FileStorage storage, IdProvider idProvider) async {
    try {
      final RenderObject? renderObject =
          screenshotKey.currentContext?.findRenderObject();
      if (renderObject == null || renderObject is! RenderRepaintBoundary) {
        logger.log(LogLevel.debug,
            'ScreenshotService: Invalid render object or not a RepaintBoundary');
        return null;
      }
      final ui.Image image = await renderObject.toImage(pixelRatio: 1);
      final Uint8List? jpg = await _encodeToJpg(logger, image);
      if (jpg == null) {
        return null;
      }
      return await _writeToFile(storage, jpg, idProvider);
    } catch (e) {
      logger.log(
          LogLevel.debug, 'ScreenshotService: Error capturing screenshot: $e');
      return null;
    }
  }

  static Future<MsrAttachment?> capture(
      Logger logger, IdProvider idProvider) async {
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
      final ByteData? byteData =
          await image.toByteData(format: ui.ImageByteFormat.rawRgba);

      if (byteData == null) {
        logger.log(
            LogLevel.debug, 'ScreenshotService: Failed to get raw RGBA bytes');
        return null;
      }

      final Uint8List rgbaBytes = byteData.buffer.asUint8List();
      final int width = image.width;
      final int height = image.height;

      // Convert raw RGBA to image package's Image
      final img.Image rgbaImage = img.Image.fromBytes(
        width: width,
        height: height,
        bytes: rgbaBytes.buffer,
        order: img.ChannelOrder.rgba,
      );

      // Encode to JPG
      final Uint8List jpgBytes =
          Uint8List.fromList(img.encodeJpg(rgbaImage, quality: 20));

      return MsrAttachment.fromBytes(
        bytes: jpgBytes,
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

  /// Writes [jpg] to a file and returns an [MsrAttachment].
  static Future<MsrAttachment?> _writeToFile(
      FileStorage storage, Uint8List jpg, IdProvider idProvider) async {
    final uuid = idProvider.uuid();
    final file = await storage.writeFile(jpg, uuid);
    if (file == null) {
      return null;
    }
    return MsrAttachment.fromPath(
      path: file.path,
      size: jpg.length,
      uuid: uuid,
      type: AttachmentType.screenshot,
    );
  }

  /// Converts a [ui.Image] to a [Uint8List] in JPG format.
  static Future<Uint8List?> _encodeToJpg(Logger logger, ui.Image image) async {
    final ByteData? byteData =
        await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (byteData == null) {
      logger.log(LogLevel.debug,
          'ScreenshotService: Failed to convert image to byte data');
      return null;
    }
    final img.Image bytes = img.Image.fromBytes(
      width: image.width,
      height: image.height,
      bytes: byteData.buffer,
      format: img.Format.uint8,
    );
    return img.encodeJpg(bytes, quality: 20);
  }
}
