import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/screen_view_data.dart';

class NavigationCollector {
  final SignalProcessor signalProcessor;

  const NavigationCollector({
    required this.signalProcessor,
  });

  Future<void> trackScreenViewEvent({
    required String name,
    required bool userTriggered,
  }) {
    final data = ScreenViewData(name: name);
    return signalProcessor.trackEvent(
      data: data,
      type: EventType.screenView,
      timestamp: DateTime.now(),
      userDefinedAttrs: {},
      userTriggered: userTriggered,
    );
  }
}
