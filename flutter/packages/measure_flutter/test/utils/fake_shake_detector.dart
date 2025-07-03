import 'package:measure_flutter/src/bug_report/shake_detector.dart';

class FakeShakeDetector extends ShakeDetector {
  Function? onShake;
  bool isRegistered = false;
  bool isBugReportFlowActive = false;

  @override
  void register() {
    isRegistered = true;
  }

  @override
  void unregister() {
    isRegistered = false;
  }

  @override
  void setShakeListener(Function? onShake) {
    this.onShake = onShake;
  }

  @override
  void setBugReportFlowActive() {
    isBugReportFlowActive = true;
  }

  @override
  void setBugReportFlowInactive() {
    isBugReportFlowActive = false;
  }
}
