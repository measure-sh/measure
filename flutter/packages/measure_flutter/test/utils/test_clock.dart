import 'package:measure_flutter/src/time/system_clock.dart';

class TestClock extends SystemClock {
  int _currentEpochMillis;

  TestClock._(this._currentEpochMillis);

  void setTime(int time) {
    _currentEpochMillis = time;
  }

  void advance(Duration duration) {
    _advanceByMillis(duration.inMilliseconds);
  }

  @override
  int epochTime() {
    return _currentEpochMillis;
  }

  void _advanceByMillis(int milliseconds) {
    _currentEpochMillis += milliseconds;
  }

  /// Default time set to Wed Oct 25 2023 18:20:15 GMT+0530
  static TestClock create([int timeInMillis = 1698238215]) {
    return TestClock._(timeInMillis);
  }
}
