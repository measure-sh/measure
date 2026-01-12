import 'package:measure_flutter/src/tracing/span.dart';
import 'package:measure_flutter/src/tracing/span_data.dart';
import 'package:measure_flutter/src/tracing/span_status.dart';

import 'checkpoint.dart';

// Implements a [Span] and adds some internal functions to it.
abstract class InternalSpan extends Span {
  /// Gets the name identifying this span.
  ///
  /// Returns the name assigned to this span when it was created.
  String get name;

  /// Gets the timestamp when this span was started.
  ///
  /// Returns the start time in milliseconds since epoch, obtained via [Measure.getCurrentTime].
  int get startTime;

  /// Gets the list of time-based checkpoints added to this span.
  ///
  /// Returns a mutable list of [Checkpoint] objects, each representing a significant
  /// point in time during the span's lifecycle
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
  /// Returns [SpanStatus] The status of the span.2
  SpanStatus getStatus();

  /// Returns a modifiable map of attributes.
  Map<String, dynamic> getAttributesMap();

  /// Returns a modifiable map of user-defined attributes.
  Map<String, dynamic> getUserDefinedAttrs();

  /// Adds an attribute to this span.
  void setInternalAttribute(MapEntry<String, dynamic> attribute);

  /// Updates the sampling status of the span.
  ///
  /// @param sampled whether the span is sampled or not.
  void setSamplingRate(bool sampled);

  /// Converts the span to a data class for further processing and export.
  SpanData toSpanData();
}
