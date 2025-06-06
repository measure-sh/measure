import 'package:measure_flutter/attribute_value.dart';

extension AttributeValueMapEncoding on Map<String, AttributeValue> {
  Map<String, Object> encode() {
    return map((key, attr) => MapEntry(key, attr.value));
  }
}
