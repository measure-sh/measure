import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/method_channel/method_constants.dart';
import 'package:measure_flutter/src/method_channel/msr_method_channel.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('MsrMethodChannel.internalAddLog', () {
    const channel = MethodChannel('measure_flutter');
    final messenger = TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger;

    tearDown(() {
      messenger.setMockMethodCallHandler(channel, null);
    });

    test('invokes functionInternalAddLog with platform and message', () async {
      MethodCall? receivedCall;
      messenger.setMockMethodCallHandler(channel, (call) async {
        receivedCall = call;
        return null;
      });

      await MsrMethodChannel().internalAddLog(
        platform: 'flutter',
        message: 'a message',
      );

      expect(receivedCall, isNotNull);
      expect(receivedCall!.method, MethodConstants.functionInternalAddLog);
      expect(receivedCall!.arguments, {
        MethodConstants.argDiagnosticModePlatform: 'flutter',
        MethodConstants.argDiagnosticModeMessage: 'a message',
      });
    });
  });
}
