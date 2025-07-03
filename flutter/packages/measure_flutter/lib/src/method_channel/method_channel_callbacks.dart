import 'package:flutter/services.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/method_channel/method_constants.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

import '../logger/logger.dart';

class MethodChannelCallbacks {
  final Logger _logger;
  Function? _onShakeDetected;

  MethodChannelCallbacks(MsrMethodChannel channel, this._logger) {
    channel.setMethodCallHandler(_handleMethodCall);
  }

  set onShakeDetectedCallback(Function? callback) {
    _onShakeDetected = callback;
  }

  Future<void> _handleMethodCall(MethodCall call) async {
    switch (call.method) {
      case MethodConstants.callbackOnShakeDetected:
        _onShakeDetected?.call();
        break;
      default:
        _logger.log(
            LogLevel.error, "No method handler found for ${call.method}");
    }
  }
}
