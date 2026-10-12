import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_collector.dart';
import 'package:measure_flutter/src/gestures/layout_snapshot_throttler.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/screen_view_data.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/utils/validation_limits.dart';

import '../../measure_flutter.dart';

class NavigationCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  final TimeProvider timeProvider;
  final LayoutSnapshotCollector layoutSnapshotCollector;
  final LayoutSnapshotThrottler layoutSnapshotThrottler;
  bool _enabled = false;

  NavigationCollector({
    required this.logger,
    required this.signalProcessor,
    required this.timeProvider,
    required this.layoutSnapshotCollector,
    required this.layoutSnapshotThrottler,
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
    var screenName = name;
    if (screenName.length > ValidationLimits.screenViewName) {
      if (userTriggered) {
        logger.log(
          LogLevel.error,
          "Invalid screen view: name exceeds maximum length of ${ValidationLimits.screenViewName} characters",
        );
        return;
      }
      screenName = screenName.substring(0, ValidationLimits.screenViewName);
    }
    final eventTimestamp = timestamp ?? timeProvider.now();
    final attachment =
        captureLayoutSnapshot && layoutSnapshotThrottler.shouldTakeSnapshot()
            ? await layoutSnapshotCollector.captureAttachmentAfterNextFrame()
            : null;
    return signalProcessor.trackEvent(
      data: ScreenViewData(name: screenName),
      type: EventType.screenView,
      timestamp: eventTimestamp,
      userDefinedAttrs: attributes,
      userTriggered: userTriggered,
      attachments: attachment != null ? [attachment] : null,
    );
  }
}
