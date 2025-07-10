import 'dart:async';

import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/events/custom_event_data.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/navigation/screen_view_data.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';
import 'package:measure_flutter/src/tracing/span_data.dart';

class TrackedEvent<T extends JsonSerialized> {
  final T data;
  final String type;
  final int timestamp;
  final Map<String, AttributeValue> userDefinedAttrs;
  final bool userTriggered;
  final String? threadName;
  final List<MsrAttachment>? attachments;

  TrackedEvent({
    required this.data,
    required this.type,
    required this.timestamp,
    required this.userDefinedAttrs,
    required this.userTriggered,
    this.threadName,
    this.attachments,
  });
}

class FakeSignalProcessor implements SignalProcessor {
  final trackedExceptions = <ExceptionData>[];
  final trackedCustomEvents = <CustomEventData>[];
  final trackedScreenViewEvents = <ScreenViewData>[];
  final List<SpanData> trackedSpans = [];
  final List<TrackedEvent> trackedEvents = [];

  @override
  Future<void> trackEvent<T extends JsonSerialized>({
    required T data,
    required String type,
    required int timestamp,
    required Map<String, AttributeValue> userDefinedAttrs,
    required bool userTriggered,
    String? threadName,
    List<MsrAttachment>? attachments,
  }) async {
    trackedEvents.add(TrackedEvent(
      data: data,
      type: type,
      timestamp: timestamp,
      userDefinedAttrs: userDefinedAttrs,
      userTriggered: userTriggered,
      threadName: threadName,
      attachments: attachments,
    ));
    
    if (data is ExceptionData) {
      trackedExceptions.add(data);
    }
    if (data is CustomEventData) {
      trackedCustomEvents.add(data);
    }
    if (data is ScreenViewData) {
      trackedScreenViewEvents.add(data);
    }
    return Future<void>.value();
  }

  @override
  Future<void> trackSpan(SpanData spanData) async {
    trackedSpans.add(spanData);
  }
}
