import 'dart:io';
import 'dart:typed_data';

import 'package:measure_flutter/src/logger/log_level.dart';

import '../logger/logger.dart';
import '../method_channel/msr_method_channel.dart';

class FileStorage {
  final MsrMethodChannel _methodChannel;
  final Logger _logger;
  String? _rootPath;

  FileStorage(MsrMethodChannel methodChannel, Logger logger)
      : _methodChannel = methodChannel,
        _logger = logger;

  Future<String?> getRootPath() async {
    _rootPath ??= await _methodChannel.getAttachmentDirectory();
    return _rootPath;
  }

  Future<String?> getDynamicConfigPath() async {
    try {
      final dynamicConfigPath = await _methodChannel.getDynamicConfigPath();
      if (dynamicConfigPath == null) {
        return null;
      }
      final file = File(dynamicConfigPath);
      return await file.readAsString();
    } catch (e, stacktrace) {
      _logger.log(LogLevel.error, 'Error loading dynamic config', e, stacktrace);
      return null;
    }
  }

  Future<File?> writeFile(Uint8List data, String fileName) async {
    try {
      _rootPath ??= await _methodChannel.getAttachmentDirectory();
      final file = File('$_rootPath/$fileName');
      await file.writeAsBytes(data);
      return file;
    } catch (e, stacktrace) {
      _logger.log(LogLevel.error, 'Error writing file', e, stacktrace);
      return null;
    }
  }
}
