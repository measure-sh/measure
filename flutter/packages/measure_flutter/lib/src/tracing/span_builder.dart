import 'span.dart';

/// Interface for configuring and creating a new [Span].
abstract class SpanBuilder {
  /// Sets the parent span for the span being built.
  ///
  /// [span] The span to set as parent
  SpanBuilder setParent(Span span);

  /// Creates and starts a new span with the current time.
  ///
  /// Returns a new [Span] instance.
  ///
  /// Note: After calling this method, any further builder configurations will be ignored.
  /// The start time is automatically set using [Measure.getCurrentTime].
  Span startSpan({int? timestamp});
}
