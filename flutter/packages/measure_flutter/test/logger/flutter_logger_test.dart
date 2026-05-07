import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/logger/flutter_logger.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/method_channel/msr_platform_interface.dart';

import '../utils/fake_msr_method_channel.dart';

void main() {
  group('FlutterLogger diagnostic mode', () {
    late FakeMethodChannel fakeChannel;
    late MeasureFlutterPlatform originalInstance;

    setUp(() {
      originalInstance = MeasureFlutterPlatform.instance;
      fakeChannel = FakeMethodChannel();
      MeasureFlutterPlatform.instance = fakeChannel;
    });

    tearDown(() {
      MeasureFlutterPlatform.instance = originalInstance;
    });

    test('does not call internalAddLog when diagnostic mode is off', () async {
      final logger = FlutterLogger(enabled: true, enableDiagnosticMode: false);

      logger.log(LogLevel.info, 'hello');
      await Future<void>.delayed(Duration.zero);

      expect(fakeChannel.internalAddLogCalls, isEmpty);
    });

    test('calls internalAddLog with platform=flutter when diagnostic mode is on',
        () async {
      final logger = FlutterLogger(enabled: false, enableDiagnosticMode: true);

      logger.log(LogLevel.info, 'a message');
      await Future<void>.delayed(Duration.zero);

      expect(fakeChannel.internalAddLogCalls, hasLength(1));
      final call = fakeChannel.internalAddLogCalls.single;
      expect(call.platform, 'flutter');
      expect(call.message, 'a message');
      expect(call.errorMessage, isNull);
    });

    test('forwards stringified error when diagnostic mode is on', () async {
      final logger = FlutterLogger(enabled: false, enableDiagnosticMode: true);
      final error = Exception('boom');

      logger.log(LogLevel.error, 'failed', error);
      await Future<void>.delayed(Duration.zero);

      expect(fakeChannel.internalAddLogCalls, hasLength(1));
      expect(fakeChannel.internalAddLogCalls.single.errorMessage,
          error.toString());
    });

    test('swallows errors thrown by internalAddLog', () async {
      fakeChannel.internalAddLogShouldThrow = true;
      final logger = FlutterLogger(enabled: false, enableDiagnosticMode: true);

      expect(() => logger.log(LogLevel.info, 'x'), returnsNormally);
      await Future<void>.delayed(Duration.zero);

      expect(fakeChannel.internalAddLogCalls, hasLength(1));
    });

    test('forwards even when developer logging is disabled', () async {
      final logger = FlutterLogger(enabled: false, enableDiagnosticMode: true);

      logger.log(LogLevel.debug, 'still forwarded');
      await Future<void>.delayed(Duration.zero);

      expect(fakeChannel.internalAddLogCalls, hasLength(1));
    });
  });

  group('FlutterLogger constructor defaults', () {
    test('enableDiagnosticMode defaults to false', () {
      const logger = FlutterLogger(enabled: true);
      expect(logger.enableDiagnosticMode, isFalse);
    });
  });
}
