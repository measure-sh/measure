import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';

class FakeSignalProcessor implements SignalProcessor {
  final trackedExceptions = <ExceptionData>[];
  final trackedCustomEvents = <CustomEventData>[];

  @override
  Future<void> trackEvent<T extends JsonSerialized>({
    required T data,
    required String type,
    required DateTime timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
  }) async {
    if (data is ExceptionData) {
      trackedExceptions.add(data);
    }
    if (data is CustomEventData) {
      trackedCustomEvents.add(data);
    }
    return Future<void>.value();
  }
}
