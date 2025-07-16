/// Specifies the status of the operation for which the span has been created.
enum SpanStatus {
  /// Default value for all spans.
  unset(0),

  /// The operation completed successfully.
  ok(1),

  /// The operation ended in a failure.
  error(2);

  /// The value to use when marshalling this enum.
  const SpanStatus(this.value);

  /// The integer value associated with this status.
  final int value;
}
