import 'span.dart';
import 'span_status.dart';
import 'span_data.dart';
import 'checkpoint.dart';

/// Implements a [Span] and adds some internal functions to it.
abstract class InternalSpan implements Span {
  /// Gets the name identifying this span.
  ///
  /// Returns the name assigned to this span when it was created.
  String get name;

  /// Gets the session identifier associated with this span. A v4-UUID string.
  ///
  /// Returns the unique identifier for the session this span belongs to.
  String get sessionId;

  /// Gets the timestamp when this span was started.
  ///
  /// Returns the start time in milliseconds since epoch.
  int get startTime;

  /// Gets the list of time-based checkpoints added to this span.
  ///
  /// Returns a list of [Checkpoint] objects, each representing a significant
  /// point in time during the span's lifecycle.
  ///
  /// Note: Checkpoints can be added during the span's lifetime using [setCheckpoint] to mark
  /// important events or transitions within the traced operation.
  List<Checkpoint> get checkpoints;

  /// Gets the map of attributes attached to this span.
  ///
  /// Returns the attributes added to the span.
  Map<String, dynamic> get attributes;

  /// Gets the current status of this span, indicating its outcome or error state.
  ///
  /// Returns [SpanStatus] The status of the span.
  SpanStatus getStatus();

  /// Returns a modifiable map of attributes.
  Map<String, dynamic> getAttributesMap();

  /// Returns a modifiable map of user-defined attributes.
  Map<String, dynamic> getUserDefinedAttrs();

  /// Adds an attribute to this span.
  void setInternalAttribute(String key, dynamic value);

  /// Converts the span to a data class for further processing and export.
  SpanData toSpanData();
}