import 'package:flutter/widgets.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/gestures/msr_gesture_detector.dart';
import 'package:measure_flutter/src/isolate/file_processor.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/storage/file_storage.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

/// Captures layout snapshots and turns them into attachments for other
/// collectors to add to their events.
class LayoutSnapshotCollector {
  final ConfigProvider _configProvider;
  final FileStorage _fileStorage;
  final Logger _logger;
  final IdProvider _idProvider;

  LayoutSnapshotCollector(
    this._configProvider,
    this._fileStorage,
    this._logger,
    this._idProvider,
  );

  /// Captures the widget tree once the next frame has been rendered, so that a
  /// screen which just appeared has been laid out, and returns it as an
  /// attachment. Returns null when no snapshot could be taken.
  Future<MsrAttachment?> captureAttachmentAfterNextFrame() async {
    try {
      await WidgetsBinding.instance.endOfFrame;
      final rootElement = layoutSnapshotRootElement;
      if (rootElement == null) {
        _logger.log(
          LogLevel.debug,
          'LayoutSnapshotCollector: MeasureWidget is not in the widget tree',
        );
        return null;
      }
      final result = LayoutSnapshotCapture.capture(
        rootElement,
        screenBounds: _screenBounds(rootElement),
        widgetFilter: _configProvider.widgetFilter,
        devicePixelRatio: MediaQuery.of(rootElement).devicePixelRatio,
      );
      if (result == null) {
        return null;
      }
      return await createAttachment(result.snapshot);
    } catch (e) {
      _logger.log(
        LogLevel.debug,
        'LayoutSnapshotCollector: Error capturing layout snapshot: $e',
      );
      return null;
    }
  }

  /// Creates an attachment from an already-captured layout snapshot.
  ///
  /// Serializes the [snapshot] to JSON and writes it to a file in an isolate.
  /// Returns an [MsrAttachment] with the file path, or null if the operation fails.
  Future<MsrAttachment?> createAttachment(SnapshotNode snapshot) async {
    try {
      final rootPath = await _fileStorage.getRootPath();
      if (rootPath == null) {
        _logger.log(
          LogLevel.debug,
          'LayoutSnapshotCollector: Root path is null',
        );
        return null;
      }

      final uuid = _idProvider.uuid();
      final result = await writeJsonToFileInIsolate(
        WriteLayoutSnapshotParams(
          snapshot: snapshot,
          fileName: uuid,
          rootPath: rootPath,
          compress: true,
        ),
      );

      final filePath = result.filePath;
      final fileSize = result.size;

      if (filePath == null || fileSize == null) {
        _logger.log(
          LogLevel.debug,
          'LayoutSnapshotCollector: Failed to write JSON file: ${result.error}',
        );
        return null;
      }

      _logger.log(
        LogLevel.debug,
        'LayoutSnapshotCollector: Successfully stored layout snapshot attachment (id: $uuid, size: $fileSize bytes, path: $filePath)',
      );

      return MsrAttachment.fromPath(
        path: filePath,
        type: AttachmentType.layoutSnapshotJson,
        size: fileSize,
        uuid: uuid,
        fileExtension: 'json.gz',
      );
    } catch (e) {
      _logger.log(
        LogLevel.debug,
        'LayoutSnapshotCollector: Error capturing layout snapshot: $e',
      );
      return null;
    }
  }

  Rect? _screenBounds(Element rootElement) {
    final renderObject = rootElement.renderObject;
    if (renderObject is! RenderBox || !renderObject.hasSize) {
      return null;
    }
    final size = renderObject.size;
    return Rect.fromLTWH(0, 0, size.width, size.height);
  }
}
