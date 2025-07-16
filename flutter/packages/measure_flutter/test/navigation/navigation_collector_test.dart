import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/navigation/navigation_collector.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_signal_processor.dart';
import '../utils/test_clock.dart';

void main() {
  group('NavigationCollector', () {
    late FakeSignalProcessor fakeSignalProcessor;
    late NavigationCollector navigationCollector;
    late TimeProvider timeProvider;

    setUp(() {
      fakeSignalProcessor = FakeSignalProcessor();
      timeProvider = FlutterTimeProvider(TestClock.create());
      navigationCollector = NavigationCollector(
        signalProcessor: fakeSignalProcessor,
        timeProvider: timeProvider,
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
