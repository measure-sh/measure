import 'package:json_annotation/json_annotation.dart';

/// The severity of an exception.
enum ExceptionSeverity {
  /// An unhandled exception or ANR that crashed the app.
  /// Not produced by the Flutter SDK; reserved for schema parity.
  @JsonValue('fatal')
  fatal,

  /// An exception tracked explicitly by the app using the public API.
  @JsonValue('handled')
  handled,

  /// An unhandled exception that did not crash the app.
  @JsonValue('unhandled')
  unhandled,
}
