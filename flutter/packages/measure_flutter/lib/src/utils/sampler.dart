import '../config/config_provider.dart';

abstract class Sampler {
  bool shouldSampleTrace(String traceId);
}

class SamplerImpl implements Sampler {
  final ConfigProvider _configProvider;

  SamplerImpl(this._configProvider);

  @override
  bool shouldSampleTrace(String traceId) {
    if (_configProvider.traceSamplingRate == 0.0) {
      return false;
    }
    if (_configProvider.traceSamplingRate == 100.0) {
      return true;
    }

    final sampleRate = _configProvider.traceSamplingRate / 100;
    final idLo = _longFromBase16String(traceId, 16);
    final threshold = (0x7FFFFFFFFFFFFFFF * sampleRate).toInt();
    return (idLo & 0x7FFFFFFFFFFFFFFF) < threshold;
  }

  /// Converts a base16 (hex) string to a long value.
  ///
  /// [input] the hex string to convert
  /// [index] the starting position in the string (for reading the lower 64 bits)
  int _longFromBase16String(String input, int index) {
    if (index < 0 || index >= input.length) {
      return 0;
    }

    // Read up to 16 hex characters (64 bits) from the given index
    final endIndex = (index + 16 > input.length) ? input.length : index + 16;
    final hexSubstring = input.substring(index, endIndex);

    try {
      return int.parse(hexSubstring, radix: 16);
    } catch (e) {
      return 0;
    }
  }
}
