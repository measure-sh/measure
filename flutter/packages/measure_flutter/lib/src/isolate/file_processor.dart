import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:measure_flutter/src/isolate/file_processing_isolate.dart';

import '../gestures/snapshot_node.dart';

FileProcessingIsolate? _sharedWorker;

/// Initialize the shared file processing isolate worker for the JSON write path.
void initializeFileProcessingIsolate(FileProcessingIsolate worker) {
  _sharedWorker = worker;
}

class WriteLayoutSnapshotParams {
  final SnapshotNode snapshot;
  final String fileName;
  final String rootPath;
  final bool compress;

  const WriteLayoutSnapshotParams({
    required this.snapshot,
    required this.fileName,
    required this.rootPath,
    this.compress = true,
  });
}

class FileProcessingResult {
  final String? filePath;
  final String? error;
  final int? size;

  const FileProcessingResult({this.filePath, this.error, this.size});
}

Future<FileProcessingResult> writeJsonToFileInIsolate(WriteLayoutSnapshotParams params) async {
  final worker = _sharedWorker;
  if (worker == null) {
    return const FileProcessingResult(error: 'File processing isolate not initialized');
  }
  return worker.processLayoutSnapshotWrite(
    params.snapshot,
    params.fileName,
    params.rootPath,
    compress: params.compress,
  );
}

Future<String> _writeFile(Uint8List data, String fileName, String rootPath) async {
  final file = File('$rootPath/$fileName');
  await file.writeAsBytes(data);
  return file.path;
}

/// Serialize JSON and write to file
Future<FileProcessingResult> writeJsonToFileInIsolateWorker(
  SnapshotNode snapshot,
  String fileName,
  String rootPath,
  bool compress,
) async {
  try {
    final jsonString = jsonEncode(snapshot.toJson());
    final jsonBytes = utf8.encode(jsonString);

    final Uint8List dataToWrite;
    if (compress) {
      final compressedBytes = gzip.encode(jsonBytes);
      dataToWrite = Uint8List.fromList(compressedBytes);
    } else {
      dataToWrite = Uint8List.fromList(jsonBytes);
    }

    final filePath = await _writeFile(dataToWrite, fileName, rootPath);

    return FileProcessingResult(
      filePath: filePath,
      size: dataToWrite.length,
    );
  } catch (e) {
    return FileProcessingResult(error: e.toString());
  }
}
