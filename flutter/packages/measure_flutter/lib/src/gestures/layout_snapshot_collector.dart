import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/bug_report/attachment_processing.dart';
import 'package:measure_flutter/src/storage/file_storage.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

/// Processes layout snapshots and creates attachments by serializing them to JSON files.
class LayoutSnapshotCollector {
  final Logger _logger;
  final IdProvider _idProvider;
  final FileStorage _fileStorage;

  LayoutSnapshotCollector({
    required Logger logger,
    required IdProvider idProvider,
    required FileStorage fileStorage,
  })  : _logger = logger,
        _idProvider = idProvider,
        _fileStorage = fileStorage;

  /// Creates an attachment from an already-captured layout snapshot.
  ///
  /// Serializes the [snapshot] to JSON and writes it to a file in an isolate.
  /// Returns an [MsrAttachment] with the file path, or null if the operation fails.
  Future<MsrAttachment?> createAttachment(LayoutSnapshot snapshot) async {
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
      );
    } catch (e) {
      _logger.log(
        LogLevel.debug,
        'LayoutSnapshotCollector: Error capturing layout snapshot: $e',
      );
      return null;
    }
  }
}
