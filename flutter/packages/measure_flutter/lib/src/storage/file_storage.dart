import 'dart:io';
import 'dart:typed_data';

import 'package:measure_flutter/src/logger/log_level.dart';

import '../logger/logger.dart';
import '../method_channel/msr_method_channel.dart';

class FileStorage {
  final MsrMethodChannel _methodChannel;
  final Logger _logger;
  String? rootPath;

  FileStorage(MsrMethodChannel methodChannel, Logger logger)
      : _methodChannel = methodChannel,
        _logger = logger;

  Future<File?> writeFile(Uint8List data, String fileName) async {
    try {
      rootPath ??= await _methodChannel.getAttachmentDirectory();
      final file = File('$rootPath/$fileName');
      await file.writeAsBytes(data);
      return file;
    } catch (e, stacktrace) {
      _logger.log(LogLevel.error, 'Error writing file', e, stacktrace);
      return null;
    }
  }
}
