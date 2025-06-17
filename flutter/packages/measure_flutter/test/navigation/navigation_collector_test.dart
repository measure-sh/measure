import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';

import '../utils/fake_signal_processor.dart';

void main() {
  group('NavigationCollector', () {
    late FakeSignalProcessor fakeSignalProcessor;
    late NavigationCollector navigationCollector;

    setUp(() {
      fakeSignalProcessor = FakeSignalProcessor();
      navigationCollector = NavigationCollector(
        signalProcessor: fakeSignalProcessor,
      );
      navigationCollector.register();
    });

    group('trackScreenViewEvent', () {
      test('should track screen view event', () async {
        // Arrange
        const screenName = 'HomeScreen';
        const userTriggered = true;

        // Act
        await navigationCollector.trackScreenViewEvent(
          name: screenName,
          userTriggered: userTriggered,
        );

        // Assert
        expect(fakeSignalProcessor.trackedScreenViewEvents.length, equals(1));

        final trackedEvent = fakeSignalProcessor.trackedScreenViewEvents.first;
        expect(trackedEvent.name, equals(screenName));
      });
    });
  });
}
