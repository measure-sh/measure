import 'span.dart';
import 'span_builder.dart';

/// An interface to create a span.
abstract class Tracer {
  /// Creates a new [SpanBuilder] for building a span with the given name.
  ///
  /// [name] - The name of the span to be created
  SpanBuilder spanBuilder(String name);

  /// Gets the trace parent header value for the given span.
  ///
  /// [span] - The span to get the header value for
  String getTraceParentHeaderValue(Span span);

  /// Gets the trace parent header key.
  String getTraceParentHeaderKey();
}