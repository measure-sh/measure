import 'dart:io';
import 'dart:typed_data';

import 'package:measure_flutter/src/storage/file_storage.dart';

class FakeFileStorage implements FileStorage {
  final Map<String, Uint8List> _storedFiles = {};
  bool shouldFailWrite = false;
  int? shouldFailWriteAfterCount;
  int _writeCount = 0;

  final String _rootPath = '/fake/root/path';

  @override
  Future<File?> writeFile(Uint8List data, String fileName) async {
    _writeCount++;

    if (shouldFailWrite) {
      return null;
    }

    if (shouldFailWriteAfterCount != null &&
        _writeCount > shouldFailWriteAfterCount!) {
      return null;
    }

    _storedFiles[fileName] = data;
    return File('$_rootPath/$fileName');
  }

  Uint8List? getStoredFile(String fileName) {
    return _storedFiles[fileName];
  }

  void clearStoredFiles() {
    _storedFiles.clear();
  }

  int get storedFileCount => _storedFiles.length;

  @override
  Future<String?> getRootPath() async {
    return _rootPath;
  }

  @override
  Future<String?> getDynamicConfigPath() async {
    return _rootPath;
  }
}
