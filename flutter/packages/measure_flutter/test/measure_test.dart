import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';

import 'utils/test_method_channel.dart';

void main() {
  group('User ID', () {
    test('sets user id', () async {
      // Given an initialized measure instance
      final methodChannel = TestMethodChannel();
      final measure = Measure.withMethodChannel(methodChannel);

      await measure.init(
        () {},
        config: const MeasureConfig(),
      );

      // When
      await measure.setUserId("user-id");

      // Then
      expect(methodChannel.userId, "user-id");
    });

    test('clears user id', () async {
      // Given an initialized measure instance
      final methodChannel = TestMethodChannel();
      final measure = Measure.withMethodChannel(methodChannel);

      await measure.init(
        () {},
        config: const MeasureConfig(),
      );

      // When
      await measure.setUserId("user-id");
      await measure.clearUserId();

      // Then
      expect(methodChannel.userId, null);
    });
  });
}
