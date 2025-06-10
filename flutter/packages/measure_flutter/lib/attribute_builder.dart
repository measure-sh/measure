import 'package:measure_flutter/attribute_value.dart';

final class AttributeBuilder {
  final Map<String, AttributeValue> _attributes = {};

  void add(String key, Object value) {
    _attributes[key] = value.toAttr();
  }

  Map<String, AttributeValue> build() => _attributes;
}

extension AttributeValueExt on Object {
  AttributeValue toAttr() {
    return switch (this) {
      String s => StringAttr(s),
      bool b => BooleanAttr(b),
      int i => IntAttr(i),
      double d => DoubleAttr(d),
      _ => throw ArgumentError('Unsupported attribute type: $runtimeType'),
    };
  }
}
