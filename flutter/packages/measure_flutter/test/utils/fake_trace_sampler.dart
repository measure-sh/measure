import 'package:measure_flutter/src/utils/sampler.dart';

class FakeSampler implements Sampler {
  bool _overrideShouldSampleTrace = true;

  set overrideShouldSampleTrace(bool value) {
    _overrideShouldSampleTrace = value;
  }

  @override
  bool shouldSampleTrace(String traceId) {
    return _overrideShouldSampleTrace;
  }
}
