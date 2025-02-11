import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/signal_processor.dart';

final class CustomEventCollector {
  final Logger logger;
  final SignalProcessor signalProcessor;
  bool enabled = false;

  CustomEventCollector({
    required this.logger,
    required this.signalProcessor,
  });

  void register() {
    enabled = true;
  }

  void unregister() {
    enabled = false;
  }

  void trackCustomEvent(
    String name,
    DateTime? timestamp,
    Map<String, dynamic> attributes,
  ) {
    if (!enabled) {
      return;
    }
    // TODO: collect event
  }
}
