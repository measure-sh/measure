import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_collector.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/measure_initializer.dart';

final class MeasureInternal {
  final MeasureInitializer initializer;
  final Logger logger;
  final CustomEventCollector _customEventCollector;

  MeasureInternal({
    required this.initializer,
  })  : logger = initializer.logger,
        _customEventCollector = initializer.customEventCollector;

  Future<void> init() async {
    registerCollectors();
  }

  void registerCollectors() {
    _customEventCollector.register();
  }

  void trackCustomEvent(String name, DateTime? timestamp,
      Map<String, AttributeValue> attributes) {
    _customEventCollector.trackCustomEvent(name, timestamp, attributes);
  }
}
