import 'package:measure_flutter/src/time/time_provider.dart';

/// Limits how often layout snapshots are taken by requiring a minimum time
/// between them. Every call counts as an attempt, so taps closer together than
/// the delay keep only the first snapshot.
class LayoutSnapshotThrottler {
  static const defaultDelayMs = 750;

  final TimeProvider _timeProvider;
  int _lastAttemptTimestamp = 0;

  LayoutSnapshotThrottler(this._timeProvider);

  bool shouldTakeSnapshot({int delayMs = defaultDelayMs}) {
    final now = _timeProvider.now();
    final previous = _lastAttemptTimestamp;
    _lastAttemptTimestamp = now;
    return previous == 0 || (now - previous) > delayMs;
  }
}
