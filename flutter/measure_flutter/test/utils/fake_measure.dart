import 'dart:async';

import 'package:measure_flutter/attribute_value.dart';
import 'package:measure_flutter/src/measure_interface.dart';

class FakeMeasure implements MeasureApi {
  final List<ScreenViewCall> trackedScreenViews = [];

  @override
  Future<void> start(FutureOr<void> Function() action,
      {bool enableLogging = false}) async {
    await action();
  }

  @override
  void trackEvent(
      {required String name,
      Map<String, AttributeValue> attributes = const {},
      DateTime? timestamp}) {}

  @override
  Future<void> trackHandledError(Object error, StackTrace stack) async {}

  @override
  void triggerNativeCrash() {}

  @override
  void trackScreenViewEvent({required String name, bool userTriggered = true}) {
    trackedScreenViews.add(ScreenViewCall(name, userTriggered));
  }

  void clear() {
    trackedScreenViews.clear();
  }
}

class ScreenViewCall {
  final String name;
  final bool userTriggered;

  ScreenViewCall(this.name, this.userTriggered);
}
