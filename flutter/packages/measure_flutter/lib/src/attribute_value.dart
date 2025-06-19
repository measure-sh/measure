/// Represents a value of an attribute. It can be a string, boolean, integer,
/// or double.
sealed class AttributeValue {
  final Object value;

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
