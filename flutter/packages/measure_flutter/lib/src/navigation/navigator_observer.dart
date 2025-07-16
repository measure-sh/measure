import 'package:flutter/material.dart';

import '../../measure_flutter.dart';

class MsrNavigatorObserver extends NavigatorObserver {
  final MeasureApi _measure;

  MsrNavigatorObserver() : _measure = Measure.instance;

  @visibleForTesting
  MsrNavigatorObserver.withMeasure(this._measure);

  @override
  void didPush(Route route, Route? previousRoute) {
    _trackScreenView(route.settings.name);
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    _trackScreenView(previousRoute?.settings.name);
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    _trackScreenView(newRoute?.settings.name);
  }

  void _trackScreenView(String? name) {
    if (name != null && name.isNotEmpty) {
      _measure.trackScreenViewEvent(name: name, userTriggered: false);
    }
  }
}
