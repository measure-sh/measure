sealed class AttributeValue {
  /// The generic value of the attribute
  final Object value;

  /// Private constructor to prevent direct instantiation
  const AttributeValue._(this.value);
}

final class StringAttr extends AttributeValue {
  StringAttr(String super.value) : super._();
}

final class BooleanAttr extends AttributeValue {
  BooleanAttr(bool super.value) : super._();
}

final class IntAttr extends AttributeValue {
  IntAttr(int super.value) : super._();
}

final class DoubleAttr extends AttributeValue {
  DoubleAttr(double super.value) : super._();
}