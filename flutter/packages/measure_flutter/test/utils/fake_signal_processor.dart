import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/screen_view_data.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';
import 'package:measure_flutter/src/tracing/span_data.dart';

class FakeSignalProcessor implements SignalProcessor {
  final trackedExceptions = <ExceptionData>[];
  final trackedCustomEvents = <CustomEventData>[];
  final trackedScreenViewEvents = <ScreenViewData>[];
  final trackedSpans = <SpanData>[];

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
    if (data is ScreenViewData) {
      trackedScreenViewEvents.add(data);
    }
    return Future.value();
  }

  @override
  Future<void> trackSpan(SpanData spanData) {
    trackedSpans.add(spanData);
    return Future.value();
  }
}
