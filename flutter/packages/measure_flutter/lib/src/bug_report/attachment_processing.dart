import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

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

class FileProcessingResult {
  final String? filePath;
  final String? error;

  const FileProcessingResult({this.filePath, this.error});
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

Future<FileProcessingResult> compressAndSaveInIsolate(
    CompressAndSaveParams params) async {
  return await Isolate.run(() => _compressAndSave(params));
}

// Private helpers
Future<FileProcessingResult> _compressAndSave(CompressAndSaveParams params) async {
  try {
    final compressedBytes = await convertImageToJpegInIsolate(
      ImageToJpegParams(
        originalBytes: params.originalBytes,
        jpegQuality: params.jpegQuality,
      ),
    );

    final filePath = await _writeFile(compressedBytes, params.fileName, params.rootPath);

    return filePath != null
        ? FileProcessingResult(filePath: filePath)
        : FileProcessingResult(error: 'Failed to write file');
  } catch (e) {
    return FileProcessingResult(error: e.toString());
  }
}

Future<String?> _writeFile(Uint8List data, String fileName, String rootPath) async {
  try {
    final file = File('$rootPath/$fileName');
    await file.writeAsBytes(data);
    return file.path;
  } catch (e) {
    return null;
  }
}