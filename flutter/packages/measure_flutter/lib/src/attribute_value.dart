/// Base class for attribute values used in events and spans.
sealed class AttributeValue {
  /// The underlying value stored in this attribute.
  final Object value;

  const AttributeValue._(this.value);
}

/// An [AttributeValue] that holds a [String] value.
final class StringAttr extends AttributeValue {
  /// Creates a [StringAttr] with the given string [value].
  StringAttr(String super.value) : super._();
}

/// An [AttributeValue] that holds a [bool] value.
final class BooleanAttr extends AttributeValue {
  /// Creates a [BooleanAttr] with the given boolean [value].
  BooleanAttr(bool super.value) : super._();
}

/// An [AttributeValue] that holds an [int] value.
final class IntAttr extends AttributeValue {
  /// Creates an [IntAttr] with the given integer [value].
  IntAttr(int super.value) : super._();
}

/// An [AttributeValue] that holds a [double] value.
final class DoubleAttr extends AttributeValue {
  /// Creates a [DoubleAttr] with the given double [value].
  DoubleAttr(double super.value) : super._();
}
