/// Severity of a log tracked using `Measure.instance.log`.
enum LogSeverity {
  debug("debug", 8),
  info("info", 12),
  warning("warning", 16),
  error("error", 20),
  fatal("fatal", 24);

  const LogSeverity(this.value, this.severityNumber);

  final String value;

  /// Numeric severity used to order and filter logs. Each level maps to the
  /// highest number in its severity band.
  final int severityNumber;
}
