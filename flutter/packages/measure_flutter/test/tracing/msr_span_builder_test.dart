import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/tracing/msr_span_builder.dart';

import '../utils/fake_id_provider.dart';
import '../utils/fake_span_processor.dart';
import '../utils/fake_trace_sampler.dart';
import '../utils/noop_logger.dart';
import '../utils/test_clock.dart';

void main() {
  final logger = NoopLogger();
  final testClock = TestClock.create();
  final timeProvider = FlutterTimeProvider(testClock);
  final spanProcessor = FakeSpanProcessor();
  final sampler = FakeSampler();
  final idProvider = FakeIdProvider();

  group("MsrSpanBuilder", () {
    test('setsParent sets span parent', () {
      final parentSpan = MsrSpanBuilder(
        name: 'parent-name',
        idProvider: idProvider,
        timeProvider: timeProvider,
        spanProcessor: spanProcessor,
        sampler: sampler,
        logger: logger,
      ).startSpan();

      final span = MsrSpanBuilder(
        name: 'span-name',
        idProvider: idProvider,
        timeProvider: timeProvider,
        spanProcessor: spanProcessor,
        sampler: sampler,
        logger: logger,
      ).setParent(parentSpan).startSpan();

      expect(span.parentId, parentSpan.spanId);
    });
  });
}
