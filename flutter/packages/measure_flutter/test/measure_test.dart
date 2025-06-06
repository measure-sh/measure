import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure.dart';

void main() {
  group('Measure initialization', () {
    test('should starts successfully', () async {
      // Given
      final measure = Measure.instance;
      // When
      var isStarted = false;
      await measure.start(() {
        isStarted = true;
      }, enableLogging: true);

      // Then
      expect(measure.isInitialized, true);
      expect(isStarted, true);
    });
  });
}
