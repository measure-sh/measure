import 'package:flutter/cupertino.dart';

import '../../measure.dart';

/// Mixin to handle shake detection to launch bug report screen.
mixin MsrShakeDetectorMixin<T extends StatefulWidget> on State<T> {
  void onShakeDetected();

  @override
  void initState() {
    super.initState();
    enableShakeDetection();
  }

  void enableShakeDetection() {
    Measure.instance.setShakeListener(onShakeDetected);
  }

  void disableShakeDetection() {
    Measure.instance.setShakeListener(null);
  }

  @override
  void dispose() {
    disableShakeDetection();
    super.dispose();
  }
}
