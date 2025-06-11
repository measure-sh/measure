import 'span.dart';

/// Interface for configuring and creating a new [Span].
abstract class SpanBuilder {
  /// Sets the parent span for the span being built.
  ///
  /// [span] - The span to set as parent
  SpanBuilder setParent(Span span);

  /// Creates and starts a new span with the current time.
  ///
  /// Returns a new [Span] instance
  ///
  /// Note: After calling this method, any further builder configurations will be ignored.
  /// The start time is automatically set using the current time.
  Span startSpan();

  /// Creates and starts a new span with the specified start time.
  ///
  /// [timeMs] - The start time in milliseconds since epoch
  /// Returns a new [Span] instance
  ///
  /// Note: After calling this method, any further builder configurations will be ignored.
  /// Use this method when you need to trace an operation that has already started.
  Span startSpanWithTime(int timeMs);
}