import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:measure_flutter/src/isolate/file_processing_isolate.dart';

import '../gestures/snapshot_node.dart';

// Module-level reference to shared file processing isolate
FileProcessingIsolate? _sharedWorker;

/// Initialize the shared file processing isolate worker
void initializeFileProcessingIsolate(FileProcessingIsolate worker) {
  _sharedWorker = worker;
}

// Parameter classes
class RgbaToJpegParams {
  final Uint8List rgbaBytes;
  final int width;
  final int height;
  final int jpegQuality;

  const RgbaToJpegParams({
    required this.rgbaBytes,
    required this.width,
    required this.height,
    required this.jpegQuality,
  });
}

class ImageToJpegParams {
  final Uint8List originalBytes;
  final int jpegQuality;

  const ImageToJpegParams({
    required this.originalBytes,
    required this.jpegQuality,
  });
}

class CompressAndSaveParams {
  final Uint8List originalBytes;
  final int jpegQuality;
  final String fileName;
  final String rootPath;

  const CompressAndSaveParams({
    required this.originalBytes,
    required this.jpegQuality,
    required this.fileName,
    required this.rootPath,
  });
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

// Core processing functions
Future<Uint8List> convertRgbaToJpegInIsolate(RgbaToJpegParams params) async {
  final rgbaImage = img.Image.fromBytes(
    width: params.width,
    height: params.height,
    bytes: params.rgbaBytes.buffer,
    order: img.ChannelOrder.rgba,
  );

  final encodedJpg = img.encodeJpg(rgbaImage, quality: params.jpegQuality);
  return Uint8List.fromList(encodedJpg);
}

Future<Uint8List> convertImageToJpegInIsolate(ImageToJpegParams params) async {
  final originalImage = img.decodeImage(params.originalBytes);
  if (originalImage == null) {
    throw Exception('Failed to decode image');
  }

  final encodedJpg = img.encodeJpg(originalImage, quality: params.jpegQuality);
  return Uint8List.fromList(encodedJpg);
}

Future<FileProcessingResult> compressAndSaveInIsolate(CompressAndSaveParams params) async {
  final worker = _sharedWorker;
  if (worker == null) {
    return const FileProcessingResult(error: 'File processing isolate not initialized');
  }
  return worker.processImageCompression(params);
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

/// Compress image and write to file
Future<FileProcessingResult> compressAndSaveInIsolateWorker(CompressAndSaveParams params) async {
  try {
    final compressedBytes = await convertImageToJpegInIsolate(
      ImageToJpegParams(
        originalBytes: params.originalBytes,
        jpegQuality: params.jpegQuality,
      ),
    );

    final filePath = await _writeFile(compressedBytes, params.fileName, params.rootPath);

    return FileProcessingResult(
      filePath: filePath,
      size: compressedBytes.length,
    );
  } catch (e) {
    return FileProcessingResult(error: e.toString());
  }
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

    final filePath = await _writeFile(
      dataToWrite,
      fileName,
      rootPath,
    );

    return FileProcessingResult(
      filePath: filePath,
      size: dataToWrite.length,
    );
  } catch (e) {
    return FileProcessingResult(error: e.toString());
  }
}
