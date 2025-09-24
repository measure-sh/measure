import 'package:measure_flutter/src/time/system_clock.dart';

/// Provides current time.
abstract interface class TimeProvider {
  /// Returns a time measurement with millisecond precision that can only be used to calculate
  /// time intervals.
  int get elapsedRealtime;

  /// Returns the current epoch timestamp in millis. This timestamp is calculated using
  /// a monotonic clock, with initial epoch time set to the time on the device during
  /// initialization.
  ///
  /// Once the time provider is initialized, this time does not get affected by clock skew.
  /// However, the initial time used during initialization can be affected by clock skew.
  int now();
}

class FlutterTimeProvider implements TimeProvider {
  final SystemClock systemClock;

  FlutterTimeProvider(this.systemClock);

  @override
  int get elapsedRealtime => systemClock.epochTime();

  @override
  int now() => systemClock.epochTime();
}
