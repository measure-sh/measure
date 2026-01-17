import 'dart:convert';

import 'package:measure_flutter/src/config/dynamic_config.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/storage/file_storage.dart';

class ConfigLoader {
  final Logger logger;
  final FileStorage fileStorage;

  const ConfigLoader({
    required this.logger,
    required this.fileStorage,
  });

  Future<DynamicConfig?> loadDynamicConfig() async {
    final content = await fileStorage.getDynamicConfigPath();
    if (content == null) {
      logger.log(LogLevel.info, 'ConfigLoader: No dynamic config found, using defaults');
      return null;
    }

    try {
      final json = jsonDecode(content) as Map<String, dynamic>;
      logger.log(LogLevel.debug, "ConfigLoader: Dynamic config loaded successfully");
      return DynamicConfig.fromJson(json);
    } catch (e, stacktrace) {
      logger.log(LogLevel.error, 'ConfigLoader: Error parsing dynamic config, using defaults', e, stacktrace);
      return null;
    }
  }
}
