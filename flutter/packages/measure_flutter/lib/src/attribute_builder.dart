import 'attribute_value.dart';

/// A fluent builder for creating attribute maps with automatic type conversion.
/// 
/// [AttributeBuilder] provides a convenient way to build maps of [AttributeValue]
/// objects from native Dart types. It automatically converts String, int, double,
/// and bool values to their corresponding [AttributeValue] types.
/// 
/// **Example:**
/// ```dart
/// final attributes = AttributeBuilder()
///     .add('user_id', 'abc123')     // Becomes StringAttr
///     .add('age', 25)               // Becomes IntAttr  
///     .add('score', 95.5)           // Becomes DoubleAttr
///     .add('is_premium', true)      // Becomes BooleanAttr
///     .build();
/// 
/// Measure.instance.trackEvent(
///   name: 'user_profile_updated',
///   attributes: attributes,
/// );
/// ```
final class AttributeBuilder {
  final Map<String, AttributeValue> _attributes = {};

  /// Adds a key-value pair to the attributes map.
  /// 
  /// The [value] is automatically converted to the appropriate [AttributeValue] type:
  /// - String → [StringAttr]
  /// - int → [IntAttr]
  /// - double → [DoubleAttr]
  /// - bool → [BooleanAttr]
  /// 
  /// **Parameters:**
  /// - [key]: The attribute key
  /// - [value]: The attribute value (String, int, double, or bool)
  /// 
  /// **Returns:** This [AttributeBuilder] instance for method chaining
  AttributeBuilder add(String key, Object value) {
    _attributes[key] = value.toAttr();
    return this;
  }

  /// Builds and returns the final attributes map.
  /// 
  /// **Returns:** A map of attribute keys to [AttributeValue] objects
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
