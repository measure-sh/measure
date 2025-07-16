/// Annotates a specific time on a span.
class Checkpoint {
  /// The name of the checkpoint.
  final String name;

  /// Time since the epoch when the checkpoint was recorded.
  final int timestamp;

  const Checkpoint({
    required this.name,
    required this.timestamp,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Checkpoint &&
          runtimeType == other.runtimeType &&
          name == other.name &&
          timestamp == other.timestamp;

  @override
  int get hashCode => name.hashCode ^ timestamp.hashCode;

  @override
  String toString() {
    return 'Checkpoint{name: $name, timestamp: $timestamp}';
  }
}
