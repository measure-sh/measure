import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/tracing/msr_span.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/noop_logger.dart';
import '../utils/test_clock.dart';

void main() {
  group("SpanProcessor", () {
    late NoopLogger logger;
    late TestClock testClock;
    late FlutterTimeProvider timeProvider;
    late FakeConfigProvider configProvider;
    late FakeSignalProcessor signalProcessor;
    late MsrSpanProcessor spanProcessor;

    setUp(() {
      logger = NoopLogger();
      testClock = TestClock.create();
      timeProvider = FlutterTimeProvider(testClock);
      configProvider = FakeConfigProvider();
      signalProcessor = FakeSignalProcessor();
      spanProcessor = MsrSpanProcessor(
        logger,
        signalProcessor,
        configProvider,
      );
    });

    test("onStart adds thread name to attributes", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: 987654321,
      );
      spanProcessor.onStart(span);

      expect(span.attributes.containsKey("thread_name"), true);
      expect(span.attributes.containsValue("main"), true);
    });

    test("onEnded delegates to signal processor", () {
      MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: testClock.epochTime() - 1000,
      ).end() as MsrSpan;

      expect(signalProcessor.trackedSpans.length, 1);
      expect(signalProcessor.trackedSpans.first.name, "span-name");
    });

    test("discards span if it exceeds max length", () {
      final longName = "s" * (configProvider.maxSpanNameLength + 1);
      MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: longName,
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() - 1000,
      ).end() as MsrSpan;

      expect(signalProcessor.trackedSpans.length, 0);
    });

    test("discards checkpoint if checkpoint name exceeds max length", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() - 1000,
      );
      final longCheckpointName =
          "s" * (configProvider.maxCheckpointNameLength + 1);
      span.setCheckpoint(longCheckpointName);
      span.end();

      expect(signalProcessor.trackedSpans.first.checkpoints.length, 0);
    });

    test(
        "discards checkpoints to keep them within max checkpoints per span limit",
            () {
          final span = MsrSpan(
            logger: logger,
            spanProcessor: spanProcessor,
            timeProvider: timeProvider,
            isSampled: true,
            name: "span-name",
            spanId: "span-id",
            traceId: "trace-id",
            parentId: null,
            startTime: timeProvider.now() - 1000,
          );

          // Add one more checkpoint than the maximum allowed
          for (int i = 0; i <= configProvider.maxCheckpointsPerSpan; i++) {
            span.setCheckpoint("checkpoint");
          }

          span.end();

          expect(
            signalProcessor.trackedSpans.first.checkpoints.length,
            configProvider.maxCheckpointsPerSpan,
          );
        });

    test("discards span if duration is negative", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() + 1000, // Start time in the future
      );

      // Add some checkpoints to verify they don't get processed
      for (int i = 0; i <= configProvider.maxCheckpointsPerSpan; i++) {
        span.setCheckpoint("checkpoint");
      }

      spanProcessor.onEnded(span);

      expect(signalProcessor.trackedSpans.length, 0);
    });

    test("discards un-sampled spans", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: false,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() + 1000, // Start time in the future
      );

      // Add some checkpoints to verify they don't get processed
      for (int i = 0; i <= configProvider.maxCheckpointsPerSpan; i++) {
        span.setCheckpoint("checkpoint");
      }

      spanProcessor.onEnded(span);

      expect(signalProcessor.trackedSpans.length, 0);
    });
  });
}
