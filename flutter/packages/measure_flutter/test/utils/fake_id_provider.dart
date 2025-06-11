import 'package:measure_flutter/src/utils/id_provider.dart';

class FakeIdProvider implements IdProvider {
  FakeIdProvider({
    String? spanId,
    String? traceId,
  })  : _spanId = spanId ?? 'fake-span-id',
        _traceId = traceId ?? 'fake-trace-id';

  final String _spanId;
  final String _traceId;
  int _spanIdCounter = 0;
  int _traceIdCounter = 0;

  @override
  String spanId() {
    _spanIdCounter++;
    return '$_spanId-$_spanIdCounter';
  }

  @override
  String traceId() {
    _traceIdCounter++;
    return '$_traceId-$_traceIdCounter';
  }
}