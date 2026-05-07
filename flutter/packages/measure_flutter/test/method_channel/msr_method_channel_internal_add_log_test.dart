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

    test('invokes functionInternalAddLog with all three args', () async {
      MethodCall? receivedCall;
      messenger.setMockMethodCallHandler(channel, (call) async {
        receivedCall = call;
        return null;
      });

      await MsrMethodChannel().internalAddLog(
        platform: 'flutter',
        message: 'a message',
        errorMessage: 'boom',
      );

      expect(receivedCall, isNotNull);
      expect(receivedCall!.method, MethodConstants.functionInternalAddLog);
      expect(receivedCall!.arguments, {
        MethodConstants.argPlatform: 'flutter',
        MethodConstants.argMessage: 'a message',
        MethodConstants.argErrorMessage: 'boom',
      });
    });

    test('forwards null errorMessage when not provided', () async {
      MethodCall? receivedCall;
      messenger.setMockMethodCallHandler(channel, (call) async {
        receivedCall = call;
        return null;
      });

      await MsrMethodChannel().internalAddLog(
        platform: 'flutter',
        message: 'no error',
      );

      expect(receivedCall!.arguments[MethodConstants.argErrorMessage], isNull);
    });
  });
}
