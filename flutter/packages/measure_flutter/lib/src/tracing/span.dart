import 'package:measure_flutter/src/tracing/span_status.dart';

import '../attribute_value.dart';
import 'invalid_span.dart';

/// Represents a unit of work or operation within a trace.
///
/// A span represents a single operation within a trace. Spans can be nested to form
/// a trace tree that represents the end-to-end execution path of an operation.
/// Each span captures timing data, status, parent-child relationships to provide context
/// about the operation.
///
/// Example:
/// ```dart
/// final span = Measure.startSpan("load_data");
/// try {
///   // perform work
///   span.setCheckpoint("checkpoint");
///   span.setStatus(SpanStatus.ok);
/// } catch (e) {
///   span.setStatus(SpanStatus.error);
/// } finally {
///   span.end();
/// }
/// ```
abstract class Span {
  /// Gets the unique identifier for the trace this span belongs to.
  ///
  /// Returns a unique string identifier generated when the root span of this trace
  /// was created. For example: "4bf92f3577b34da6a3ce929d0e0e4736"
  ///
  /// Note: All spans in the same trace share the same trace ID, allowing correlation of
  /// related operations across a distributed system.
  String get traceId;

  /// Gets the unique identifier for this span.
  ///
  /// Returns a unique string identifier generated when this span was created.
  /// For example: "00f067aa0ba902b7"
  ///
  /// Note: Each span in a trace has its own unique span ID, while sharing the same trace ID.
  /// This allows tracking of specific operations within the larger trace context.
  String get spanId;

  /// Gets the span ID of this span's parent, if one exists.
  ///
  /// Returns the unique identifier of the parent span, or null if this is a root span.
  String? get parentId;

  /// Indicates whether this span has been selected for collection and export.
  ///
  /// Sampling is performed using head-based sampling strategy - the decision is made at the root span
  /// and applied consistently to all spans within the same trace. This ensures that traces are either
  /// collected in their entirety or not at all.
  ///
  /// Returns true if this span will be sent to the server for analysis,
  /// false if it will be dropped
  ///
  /// Note: The sampling rate can be configured using [MeasureConfig.traceSamplingRate].
  bool get isSampled;

  /// Updates the status of this span.
  ///
  /// [status] The [SpanStatus] to set for this span
  ///
  /// Note: This operation has no effect if called after the span has ended.
  Span setStatus(SpanStatus status);

  /// Sets the parent span for this span, establishing a hierarchical relationship.
  ///
  /// [parentSpan] The span to set as the parent of this span
  ///
  /// Note: This operation has no effect if called after the span has ended.
  Span setParent(Span parentSpan);

  /// Adds a checkpoint marking a significant moment during the span's lifetime.
  ///
  /// [name] A descriptive name for this checkpoint, indicating what it represents
  ///
  /// Note: This operation has no effect if called after the span has ended.
  Span setCheckpoint(String name);

  /// Updates the name of the span.
  ///
  /// [name] The name to identify this span
  ///
  /// Note: This operation has no effect if called after the span has ended.
  Span setName(String name);

  /// Adds an attribute to this span.
  ///
  /// [key] The name of the attribute
  /// [value] The value of the attribute
  Span setAttributeString(String key, String value);

  /// Adds an attribute to this span.
  ///
  /// [key] The name of the attribute
  /// [value] The value of the attribute
  Span setAttributeInt(String key, int value);

  /// Adds an attribute to this span.
  ///
  /// [key] The name of the attribute
  /// [value] The value of the attribute
  Span setAttributeDouble(String key, double value);

  /// Adds an attribute to this span.
  ///
  /// [key] The name of the attribute
  /// [value] The value of the attribute
  Span setAttributeBool(String key, bool value);

  /// Adds multiple attributes to this span.
  ///
  /// See [AttributeBuilder] for a convenient way to build attribute maps.
  /// [attributes] A map of attribute names to values
  Span setAttributes(Map<String, AttributeValue> attributes);

  /// Removes an attribute from this span. No-op if the attribute does not exist.
  ///
  /// [key] The name of the attribute to remove
  Span removeAttribute(String key);

  /// Marks this span as completed, recording its end time.
  ///
  /// Note: This method can be called only once per span. Subsequent calls will have no effect.
  Span end();

  /// Marks this span as completed using the specified end time.
  ///
  /// [timestamp] The end time in milliseconds since epoch, obtained via [Measure.getCurrentTime]
  ///
  /// Note: This method can be called only once per span. Subsequent calls will have no effect.
  /// Use this variant when you need to trace an operation that has already completed and you
  /// have captured its end time using [Measure.getCurrentTime].
  Span endWithTimestamp(int timestamp);

  /// Checks if this span has been completed.
  ///
  /// Returns true if [end] has been called on this span, false otherwise
  bool hasEnded();

  /// Gets the total duration of this span in milliseconds.
  ///
  /// Returns the time elapsed between span start and end in milliseconds, or 0 if the span
  /// hasn't ended yet
  ///
  /// Note: Duration is only available after calling [end] on the span. For ongoing spans,
  /// this method returns 0.
  int getDuration();

  /// Creates an invalid span instance for error handling
  static Span invalid() {
    return InvalidSpan();
  }
}
