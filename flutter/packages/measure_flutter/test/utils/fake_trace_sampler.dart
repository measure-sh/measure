import 'package:measure_flutter/src/tracing/trace_sampler.dart';

class FakeTraceSampler implements TraceSampler {
  bool _overrideShouldSample = true;

  set overrideShouldSample(bool value) {
    _overrideShouldSample = value;
  }

  @override
  bool shouldSample() {
    return _overrideShouldSample;
  }
}
