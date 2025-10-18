import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/config/measure_config.dart';
import 'package:measure_flutter/src/measure_initializer.dart';
import 'package:measure_flutter/src/measure_internal.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('MeasureInternal - Isolate Management', () {
    late MeasureInternal measureInternal;
    late MeasureInitializer initializer;

    setUp(() {
      initializer = MeasureInitializer(
        const MeasureConfig(
          enableLogging: false,
          autoStart: false,
        ),
      );

      measureInternal = MeasureInternal(
        initializer: initializer,
        methodChannel: initializer.methodChannel,
      );
    });

    tearDown(() async {
      try {
        await measureInternal.unregisterCollectors();
      } catch (_) {}
    });

    test('init with autoStart enabled registers collectors', () async {
      final autoStartInitializer = MeasureInitializer(
        const MeasureConfig(
          enableLogging: false,
          autoStart: true,
        ),
      );

      final autoStartMeasure = MeasureInternal(
        initializer: autoStartInitializer,
        methodChannel: autoStartInitializer.methodChannel,
      );

      try {
        await autoStartMeasure.init();

        expect(
            autoStartMeasure.initializer.exceptionCollector.isEnabled(), true);
        expect(autoStartMeasure.initializer.bugReportCollector.isEnabled, true);
      } finally {
        await autoStartMeasure.unregisterCollectors();
      }
    });

    test('init with autoStart disabled does not register collectors', () async {
      await measureInternal.init();

      expect(measureInternal.initializer.exceptionCollector.isEnabled(), false);
      expect(measureInternal.initializer.bugReportCollector.isEnabled, false);
    });

    test('registerCollectors registers all collectors', () async {
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), false);

      await measureInternal.registerCollectors();

      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);
      expect(
          measureInternal.initializer.customEventCollector.isEnabled(), true);
      expect(measureInternal.initializer.bugReportCollector.isEnabled, true);
    });

    test('unregisterCollectors unregisters all collectors and disposes isolate',
        () async {
      await measureInternal.registerCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);

      await measureInternal.unregisterCollectors();

      expect(measureInternal.initializer.exceptionCollector.isEnabled(), false);
      expect(
          measureInternal.initializer.customEventCollector.isEnabled(), false);
      expect(measureInternal.initializer.bugReportCollector.isEnabled, false);
    });

    test('multiple register/unregister cycles work correctly', () async {
      await measureInternal.registerCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);

      await measureInternal.unregisterCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), false);

      await measureInternal.registerCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);

      await measureInternal.unregisterCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), false);
    });

    test('registerCollectors is idempotent', () async {
      await measureInternal.registerCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);

      await measureInternal.registerCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);
    });

    test('file processing isolate is accessible after registerCollectors',
        () async {
      await measureInternal.registerCollectors();

      final isolate = measureInternal.initializer.fileProcessingIsolate;
      expect(isolate, isNotNull);
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);
    });

    test('collectors are unregistered after unregisterCollectors', () async {
      await measureInternal.registerCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), true);

      await measureInternal.unregisterCollectors();
      expect(measureInternal.initializer.exceptionCollector.isEnabled(), false);
    });
  });
}
