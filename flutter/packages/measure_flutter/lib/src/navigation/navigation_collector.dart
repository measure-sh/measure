import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/screen_view_data.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../../measure_flutter.dart';

class NavigationCollector {
  final SignalProcessor signalProcessor;
  final TimeProvider timeProvider;
  final LayoutSnapshotCollector layoutSnapshotCollector;
  bool _enabled = false;

  NavigationCollector({
    required this.signalProcessor,
    required this.timeProvider,
    required this.layoutSnapshotCollector,
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
    required Map<String, AttributeValue> attributes,
    int? timestamp,
    bool captureLayoutSnapshot = true,
  }) async {
    if (!_enabled) {
      return;
    }
    final eventTimestamp = timestamp ?? timeProvider.now();
    final attachment = captureLayoutSnapshot
        ? await layoutSnapshotCollector.captureAttachmentAfterNextFrame()
        : null;
    return signalProcessor.trackEvent(
      data: ScreenViewData(name: name),
      type: EventType.screenView,
      timestamp: eventTimestamp,
      userDefinedAttrs: attributes,
      userTriggered: userTriggered,
      attachments: attachment != null ? [attachment] : null,
    );
  }
}
