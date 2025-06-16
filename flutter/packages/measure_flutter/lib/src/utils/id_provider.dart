import 'dart:typed_data';

import 'package:uuid/uuid.dart';

import '../tracing/randomizer.dart';

abstract class IdProvider {
  /// Returns a type 4 (pseudo randomly generated) UUID.
  String uuid();

  /// Generates a new valid span ID. It is 8 bytes (64-bit) represented
  /// as 16 lowercase hex characters.
  String spanId();

  /// Generates a new valid trace ID. It is 16 bytes (128-bit) represented
  /// as 32 lowercase hex characters.
  String traceId();
}

class IdProviderImpl implements IdProvider {
  final Randomizer _randomizer;
  final _uuid = Uuid();

  IdProviderImpl(this._randomizer);

  @override
  String uuid() => _uuid.v4();

  @override
  String spanId() {
    String id;
    do {
      id = _randomHex(8);
    } while (_isAllZero(id));
    return id;
  }

  @override
  String traceId() {
    String id;
    do {
      id = _randomHex(16);
    } while (_isAllZero(id));
    return id;
  }

  String _randomHex(int byteLength) {
    final bytes = Uint8List(byteLength);
    for (int i = 0; i < byteLength; i++) {
      bytes[i] = _randomizer.nextInt() & 0xFF;
    }
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  bool _isAllZero(String hex) {
    return RegExp(r'^0+$').hasMatch(hex);
  }
}
