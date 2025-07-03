import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

class FakeImagePicker {
  final List<XFile> _mockImages = [];
  bool _shouldThrowError = false;
  bool _shouldReturnEmpty = false;

  void addMockImage(String name, Uint8List bytes) {
    _mockImages.add(FakeXFile(name, bytes));
  }

  void setShouldThrowError(bool shouldThrow) {
    _shouldThrowError = shouldThrow;
  }

  void setShouldReturnEmpty(bool shouldReturnEmpty) {
    _shouldReturnEmpty = shouldReturnEmpty;
  }

  void clear() {
    _mockImages.clear();
    _shouldThrowError = false;
    _shouldReturnEmpty = false;
  }

  Future<List<XFile>> pickMultiImage({
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    int? limit,
  }) async {
    if (_shouldThrowError) {
      throw Exception('Failed to pick images');
    }

    if (_shouldReturnEmpty) {
      return [];
    }

    final limitToUse = limit ?? _mockImages.length;
    return _mockImages.take(limitToUse).toList();
  }
}

class FakeXFile implements XFile {
  final String _name;
  final Uint8List _bytes;

  FakeXFile(this._name, this._bytes);

  @override
  String get name => _name;

  @override
  String get path => '/fake/path/$_name';

  @override
  Future<int> length() async => _bytes.length;

  @override
  Future<DateTime> lastModified() async => DateTime.now();

  @override
  String? get mimeType => 'image/png';

  @override
  Future<Uint8List> readAsBytes() async => _bytes;

  @override
  Future<String> readAsString({Encoding encoding = utf8}) async {
    throw UnimplementedError();
  }

  @override
  Stream<Uint8List> openRead([int? start, int? end]) {
    throw UnimplementedError();
  }

  @override
  Future<File> saveTo(String path) {
    throw UnimplementedError();
  }
}