import 'package:measure_flutter/src/tracing/randomizer.dart';

import '../config/config_provider.dart';

abstract class TraceSampler {
  bool shouldSample();
}

class TraceSamplerImpl implements TraceSampler {
  final Randomizer _randomizer;
  final ConfigProvider _configProvider;

  TraceSamplerImpl(this._randomizer, this._configProvider);

  @override
  bool shouldSample() {
    if (_configProvider.traceSamplingRate == 0.0) {
      return false;
    }
    if (_configProvider.traceSamplingRate == 1.0) {
      return true;
    }
    return _randomizer.random() < _configProvider.traceSamplingRate;
  }
}
