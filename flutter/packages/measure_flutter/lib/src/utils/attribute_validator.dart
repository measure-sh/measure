import 'package:measure_flutter/src/attribute_value.dart';
import 'package:measure_flutter/src/config/config_provider.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';

final RegExp _attributeKeyRegex = RegExp(r'^[a-zA-Z0-9_-]+$');

/// Returns true if [key] only contains alphabets, numbers, hyphens and
/// underscores and is within the maximum key length.
bool isValidAttributeKey(String key, ConfigProvider configProvider) {
  return key.length <= configProvider.maxUserDefinedAttributeKeyLength &&
      _attributeKeyRegex.hasMatch(key);
}

/// Returns true if [value] is within the maximum value length. Accepts both
/// an [AttributeValue] and the raw value stored on a span.
bool isValidAttributeValue(Object? value, ConfigProvider configProvider) {
  final raw = value is AttributeValue ? value.value : value;
  return raw is! String ||
      raw.length <= configProvider.maxUserDefinedAttributeValueLength;
}

/// Returns the valid entries of [attributes]
Map<String, V> dropInvalidAttributes<V>(
  String name,
  Map<String, V> attributes,
  ConfigProvider configProvider,
  Logger logger,
) {
  final valid = <String, V>{};
  for (final entry in attributes.entries) {
    if (valid.length >= configProvider.maxUserDefinedAttributesPerEvent) {
      break;
    }
    if (isValidAttributeKey(entry.key, configProvider) &&
        isValidAttributeValue(entry.value, configProvider)) {
      valid[entry.key] = entry.value;
    }
  }
  final droppedCount = attributes.length - valid.length;
  if (droppedCount > 0) {
    logger.log(
      LogLevel.error,
      'Invalid attributes for $name: dropped $droppedCount attributes',
    );
  }
  return valid;
}
