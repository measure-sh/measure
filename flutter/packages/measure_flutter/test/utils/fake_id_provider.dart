import 'package:measure_flutter/src/utils/id_provider.dart';

class FakeIdProvider implements IdProvider {
  int _counter = 0;

  @override
  String spanId() {
    return 'span-id-${++_counter}';
  }

  @override
  String traceId() {
    return 'trace-id-${++_counter}';
  }

  @override
  String uuid() {
    return 'uuid-${++_counter}';
  }
}
