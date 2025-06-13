import 'dart:math';

/// Provides unique identifiers for spans and traces.
abstract class IdProvider {
  /// Generates a new valid span ID. It is 8 bytes (64-bit) represented
  /// as 16 lowercase hex characters.
  ///
  /// Returns a new valid span ID.
  String spanId();

  /// Generates a new valid trace ID. It is 16 bytes (128-bit) represented
  /// as 32 lowercase hex characters.
  ///
  /// Returns a new valid trace ID.
  String traceId();
}

/// Default implementation of [IdProvider] that matches OpenTelemetry specification.
class IdProviderImpl implements IdProvider {
  IdProviderImpl() : _random = Random.secure();

  final Random _random;

  @override
  String spanId() {
    int id;
    do {
      id = _nextLong();
    } while (id == 0);

    return _longToBase16String(id);
  }

  @override
  String traceId() {
    final idHi = _nextLong();
    int idLo;
    do {
      idLo = _nextLong();
    } while (idLo == 0);

    return _longToBase16String(idHi) + _longToBase16String(idLo);
  }

  /// Generates a 64-bit random number similar to Java's Random.nextLong()
  int _nextLong() {
    // Generate two 32-bit values and combine them into a 64-bit value
    final high = _random.nextInt(1 << 32);
    final low = _random.nextInt(1 << 32);
    return (high << 32) | low;
  }

  /// Converts a 64-bit long to a 16-character hex string,
  /// matching OpenTelemetry's longToBase16String
  String _longToBase16String(int value) {
    const alphabet = '0123456789abcdef';
    final result = List<String>.filled(16, '0');

    // Extract each byte from the 64-bit value and convert to hex
    for (int i = 0; i < 8; i++) {
      final byteValue = (value >> (56 - i * 8)) & 0xFF;
      final highNibble = (byteValue >> 4) & 0x0F;
      final lowNibble = byteValue & 0x0F;
      result[i * 2] = alphabet[highNibble];
      result[i * 2 + 1] = alphabet[lowNibble];
    }

    return result.join();
  }
}
