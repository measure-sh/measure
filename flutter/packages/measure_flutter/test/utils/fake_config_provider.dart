import 'package:measure_flutter/src/config/config_provider.dart';

class FakeConfigProvider implements ConfigProvider {
  @override
  int get maxSpanNameLength => 50;

  @override
  int get maxCheckpointNameLength => 25;

  @override
  int get maxCheckpointsPerSpan => 5;

  @override
  bool get autoInitializeNativeSDK => throw UnimplementedError();

  @override
  List<String> get defaultHttpContentTypeAllowlist =>
      throw UnimplementedError();

  @override
  List<String> get defaultHttpHeadersBlocklist => throw UnimplementedError();

  @override
  bool get enableLogging => throw UnimplementedError();

  @override
  List<String> get httpHeadersBlocklist => throw UnimplementedError();

  @override
  List<String> get httpUrlAllowlist => throw UnimplementedError();

  @override
  List<String> get httpUrlBlocklist => throw UnimplementedError();

  @override
  double get samplingRateForErrorFreeSessions => throw UnimplementedError();

  @override
  bool shouldTrackHttpBody(String url, String? contentType) {
    throw UnimplementedError();
  }

  @override
  bool shouldTrackHttpHeader(String key) {
    throw UnimplementedError();
  }

  @override
  bool shouldTrackHttpUrl(String url) {
    throw UnimplementedError();
  }

  @override
  double get traceSamplingRate => throw UnimplementedError();

  @override
  bool get trackActivityIntentData => throw UnimplementedError();

  @override
  bool get trackActivityLoadTime => throw UnimplementedError();

  @override
  bool get trackFragmentLoadTime => throw UnimplementedError();

  @override
  bool get trackHttpBody => throw UnimplementedError();

  @override
  bool get trackHttpHeaders => throw UnimplementedError();

  @override
  bool get trackViewControllerLoadTime => throw UnimplementedError();
}
