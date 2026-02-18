import 'package:measure_flutter/src/gestures/snapshot_node.dart';
import 'package:measure_flutter/src/isolate/file_processor.dart';
import 'package:measure_flutter/src/isolate/file_processing_isolate.dart';

/// Fake implementation of FileProcessingIsolate for testing
class FakeFileProcessingIsolate implements FileProcessingIsolate {
  bool shouldReturnError = false;
  bool shouldThrowException = false;

  @override
  Future<void> init() async {
    // No-op for testing
  }

  @override
  Future<void> dispose() async {
    // No-op for testing
  }

  @override
  Future<FileProcessingResult> processLayoutSnapshotWrite(
    SnapshotNode snapshot,
    String fileName,
    String rootPath, {
    bool compress = true,
  }) async {
    if (shouldThrowException) {
      throw Exception('Test exception');
    }

    if (shouldReturnError) {
      return const FileProcessingResult(error: 'Write failed');
    }

    final filePath = '$rootPath/$fileName';
    final jsonString = snapshot.toJson().toString();
    final size = jsonString.length;

    return FileProcessingResult(
      filePath: filePath,
      size: size,
    );
  }

  @override
  Future<FileProcessingResult> processImageCompression(
    CompressAndSaveParams params,
  ) async {
    // Not used in layout snapshot collector tests
    throw UnimplementedError();
  }

  Future<void> shutdown() async {
    // No-op for testing
  }
}
