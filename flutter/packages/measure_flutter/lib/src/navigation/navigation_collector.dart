import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/screen_view_data.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

class NavigationCollector {
  final SignalProcessor signalProcessor;
  final TimeProvider timeProvider;
  bool _enabled = false;

  NavigationCollector({
    required this.signalProcessor,
    required this.timeProvider,
  });

  void register() {
    _enabled = true;
  }

  void unregister() {
    _enabled = false;
  }

  Future<void> trackScreenViewEvent({
    required String name,
    required bool userTriggered,
  }) async {
    if (!_enabled) {
      return;
    }
    final data = ScreenViewData(name: name);
    return signalProcessor.trackEvent(
      data: data,
      type: EventType.screenView,
      timestamp: timeProvider.now(),
      userDefinedAttrs: {},
      userTriggered: userTriggered,
    );
  }
}
