import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure.dart';

void main() {
  group('Measure initialization', () {
    test('should initialize successfully', () async {
      // Given
      final measure = Measure.instance;

      // When
      await measure.init(enableLogging: true);

      // Then
      expect(measure.isInitialized, true);
    });
  });
}
