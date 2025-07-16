import 'package:measure_flutter/src/time/system_clock.dart';

class DateTimeClock implements SystemClock {
  @override
  int epochTime() {
    return DateTime.now().millisecondsSinceEpoch;
  }
}
