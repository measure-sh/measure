import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/attribute_value.dart';
import 'package:measure_flutter/src/logs/log_collector.dart';
import 'package:measure_flutter/src/logs/log_data.dart';
import 'package:measure_flutter/src/logs/log_severity.dart';
import 'package:measure_flutter/src/time/time_provider.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/noop_logger.dart';
import '../utils/test_clock.dart';

void main() {
  group('LogCollector', () {
    late LogCollector collector;
    late NoopLogger logger;
    late FakeSignalProcessor signalProcessor;
    late TimeProvider timeProvider;
    late FakeConfigProvider configProvider;

    setUp(() {
      logger = NoopLogger();
      signalProcessor = FakeSignalProcessor();
      configProvider = FakeConfigProvider();
      timeProvider = FlutterTimeProvider(TestClock.create());
      collector = LogCollector(
        logger: logger,
        signalProcessor: signalProcessor,
        timeProvider: timeProvider,
        configProvider: configProvider,
      );
    });

    test('should be disabled by default', () {
      // When
      final isEnabled = collector.isEnabled();

      // Then
      expect(isEnabled, false);
    });

    test('should enable tracking when registered', () {
      // When
      collector.register();

      // Then
      expect(collector.isEnabled(), true);
    });

    test('should disable tracking when unregistered', () {
      // Given
      collector.register();

      // When
      collector.unregister();

      // Then
      expect(collector.isEnabled(), false);
    });

    test('should not track logs when disabled', () {
      // Given
      final message = 'test log';
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog(message, LogSeverity.info, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 0);
    });

    test('should track logs when isEnabled()', () {
      // Given
      collector.register();
      final message = 'test log';
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog(message, LogSeverity.info, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 1);
    });

    test('should track log with type log and userTriggered true', () {
      // Given
      collector.register();
      final message = 'test log';
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog(message, LogSeverity.info, attributes);

      // Then
      expect(signalProcessor.trackedEvents.length, 1);
      expect(signalProcessor.trackedEvents[0].type, 'log');
      expect(signalProcessor.trackedEvents[0].userTriggered, true);
    });

    test('should serialize log with severity_text and string keys', () {
      // Given
      collector.register();
      final message = 'payment failed';
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog(message, LogSeverity.warning, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 1);
      expect(signalProcessor.trackedLogs[0].toJson(), {
        'severity_text': 'warning',
        'severity_number': 16,
        'body': 'payment failed',
      });
    });

    test('should use current time', () {
      // Given
      collector.register();
      final message = 'test log';
      final attributes = <String, AttributeValue>{};
      final logData =
          LogData(severityText: 'info', severityNumber: 12, body: message);

      // When
      collector.trackLog(message, LogSeverity.info, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 1);
      expect(signalProcessor.trackedLogs[0], logData);
      expect(signalProcessor.trackedEvents[0].timestamp, timeProvider.now());
    });

    test('should discard log with empty message', () {
      // Given
      collector.register();
      final message = '';
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog(message, LogSeverity.info, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 0);
    });

    test('should drop logs below the configured minimum level', () {
      // Given
      collector.register();
      configProvider.logMinSeverity = 16;
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog('debug', LogSeverity.debug, attributes);
      collector.trackLog('info', LogSeverity.info, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 0);
    });

    test('should track logs at or above the configured minimum level', () {
      // Given
      collector.register();
      configProvider.logMinSeverity = 16;
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog('warning', LogSeverity.warning, attributes);
      collector.trackLog('error', LogSeverity.error, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 2);
    });

    test('should drop logs whose body matches a discard pattern', () {
      // Given
      collector.register();
      configProvider.logIgnorePatterns = ['secret'];
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog(
          'this contains a secret value', LogSeverity.error, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 0);
    });

    test('should truncate message exceeding max length', () {
      // Given
      collector.register();
      final message =
          List.filled(configProvider.maxLogBodyLength + 1, 'a').join();
      final attributes = <String, AttributeValue>{};

      // When
      collector.trackLog(message, LogSeverity.info, attributes);

      // Then
      expect(signalProcessor.trackedLogs.length, 1);
      expect(
        signalProcessor.trackedLogs[0].body.length,
        configProvider.maxLogBodyLength,
      );
    });
  });
}
