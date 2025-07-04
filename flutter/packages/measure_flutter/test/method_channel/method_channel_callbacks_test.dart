import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/method_channel_callbacks.dart';
import 'package:measure_flutter/src/method_channel/method_constants.dart';

import '../utils/fake_msr_method_channel.dart';
import '../utils/noop_logger.dart';

void main() {
  group('MethodChannelCallbacks', () {
    late FakeMethodChannel channel;
    late Logger logger;
    late MethodChannelCallbacks callbacks;

    setUp(() {
      channel = FakeMethodChannel();
      logger = NoopLogger();
      callbacks = MethodChannelCallbacks(channel, logger);
    });

    test('registers method call handler on creation', () {
      expect(channel.handler, isNotNull);
    });

    test(
        'calls shake detected callback when onShakeDetected method is received',
        () async {
      bool callbackInvoked = false;

      callbacks.onShakeDetectedCallback = () {
        callbackInvoked = true;
      };

      await channel.simulateMethodCall(MethodConstants.callbackOnShakeDetected);

      expect(callbackInvoked, isTrue);
    });

    test('does not crash when shake detected callback is null', () async {
      callbacks.onShakeDetectedCallback = null;

      expect(
        () =>
            channel.simulateMethodCall(MethodConstants.callbackOnShakeDetected),
        returnsNormally,
      );
    });
  });
}
