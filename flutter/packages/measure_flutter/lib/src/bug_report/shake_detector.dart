import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

import '../method_channel/method_channel_callbacks.dart';

abstract class ShakeDetector {
  void setShakeListener(Function? onShake);

  void register();

  void unregister();

  void setBugReportFlowActive();

  void setBugReportFlowInactive();
}

class ShakeDetectorImpl implements ShakeDetector {
  final MsrMethodChannel _methodChannel;
  final MethodChannelCallbacks _methodChannelCallbacks;
  bool _isRegistered = false;

  ShakeDetectorImpl({
    required MsrMethodChannel methodChannel,
    required MethodChannelCallbacks methodChannelCallbacks,
  })  : _methodChannel = methodChannel,
        _methodChannelCallbacks = methodChannelCallbacks;

  @override
  void register() {
    _isRegistered = true;
  }

  @override
  void setShakeListener(Function? onShake) {
    if (!_isRegistered) {
      return;
    }
    if (onShake != null) {
      _methodChannel.enableShakeDetector();
    } else {
      _methodChannel.disableShakeDetector();
    }
    _methodChannelCallbacks.onShakeDetectedCallback = onShake;
  }

  @override
  void unregister() {
    _isRegistered = false;
  }

  @override
  void setBugReportFlowActive() {
    _methodChannel.disableShakeDetector();
  }

  @override
  void setBugReportFlowInactive() {
    _methodChannel.enableShakeDetector();
  }
}
