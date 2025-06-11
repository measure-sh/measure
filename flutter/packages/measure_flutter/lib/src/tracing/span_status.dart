import 'package:json_annotation/json_annotation.dart';

/// Specifies the status of the operation for which the span has been created.
@JsonEnum(valueField: 'value')
enum SpanStatus {
  /// Default value for all spans.
  unset(0),

  /// The operation completed successfully.
  ok(1),

  /// The operation ended in a failure.
  error(2);

  const SpanStatus(this.value);

  /// The value to use when marshalling this enum.
  final int value;
}