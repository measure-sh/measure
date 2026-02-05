import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/tracing/msr_span.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';

import '../utils/fake_config_provider.dart';
import '../utils/fake_signal_processor.dart';
import '../utils/fake_trace_sampler.dart';
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
    late FakeSampler sampler;

    setUp(() {
      logger = NoopLogger();
      testClock = TestClock.create();
      timeProvider = FlutterTimeProvider(testClock);
      configProvider = FakeConfigProvider();
      signalProcessor = FakeSignalProcessor();
      sampler = FakeSampler();
      spanProcessor = MsrSpanProcessor(
        logger,
        signalProcessor,
        configProvider,
        sampler,
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

    test("buffers spans before config is loaded", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: testClock.epochTime() - 1000,
      );
      spanProcessor.onStart(span);
      span.end();

      // Span should not be processed yet
      expect(signalProcessor.trackedSpans.length, 0);
    });

    test("processes buffered spans after config loads", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: testClock.epochTime() - 1000,
      );
      spanProcessor.onStart(span);
      span.end();

      // Load config
      spanProcessor.onConfigLoaded();

      // Now span should be processed
      expect(signalProcessor.trackedSpans.length, 1);
      expect(signalProcessor.trackedSpans.first.name, "span-name");
    });

    test("processes only ended spans when config loads", () {
      final span1 = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-1",
        spanId: "span-id-1",
        traceId: "trace-id-1",
        parentId: null,
        startTime: testClock.epochTime() - 1000,
      );
      spanProcessor.onStart(span1);
      span1.end();

      final span2 = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-2",
        spanId: "span-id-2",
        traceId: "trace-id-2",
        parentId: null,
        startTime: testClock.epochTime() - 1000,
      );
      spanProcessor.onStart(span2);

      spanProcessor.onConfigLoaded();

      // Only ended span should be processed
      expect(signalProcessor.trackedSpans.length, 1);
      expect(signalProcessor.trackedSpans.first.name, "span-1");
    });

    test("delegates to signal processor after config is loaded", () {
      // Load config first
      spanProcessor.onConfigLoaded();

      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: testClock.epochTime() - 1000,
      );
      spanProcessor.onStart(span);
      span.end();

      expect(signalProcessor.trackedSpans.length, 1);
      expect(signalProcessor.trackedSpans.first.name, "span-name");
    });

    test("discards span if it exceeds max length", () {
      final longName = "s" * (configProvider.maxSpanNameLength + 1);
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: longName,
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() - 1000,
      );
      spanProcessor.onStart(span);
      span.end();

      spanProcessor.onConfigLoaded();

      expect(signalProcessor.trackedSpans.length, 0);
    });

    test("discards span with blank name", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "   ",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() - 1000,
      );
      spanProcessor.onStart(span);
      span.end();

      spanProcessor.onConfigLoaded();

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
      spanProcessor.onStart(span);
      final longCheckpointName =
          "s" * (configProvider.maxCheckpointNameLength + 1);
      span.setCheckpoint(longCheckpointName);
      span.end();

      spanProcessor.onConfigLoaded();

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
          spanProcessor.onStart(span);

          // Add one more checkpoint than the maximum allowed
          for (int i = 0; i <= configProvider.maxCheckpointsPerSpan; i++) {
            span.setCheckpoint("checkpoint-$i");
          }

          span.end();
          spanProcessor.onConfigLoaded();

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
      spanProcessor.onStart(span);

      // Add some checkpoints to verify they don't get processed
      for (int i = 0; i <= configProvider.maxCheckpointsPerSpan; i++) {
        span.setCheckpoint("checkpoint-$i");
      }

      span.end();
      spanProcessor.onConfigLoaded();

      expect(signalProcessor.trackedSpans.length, 0);
    });

    test("removes invalid user-defined attributes by key length", () {
      spanProcessor.onConfigLoaded();

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
      spanProcessor.onStart(span);

      final longKey = "k" * (configProvider.maxUserDefinedAttributeKeyLength + 1);
      span.setAttributeString(longKey, "value");
      span.setAttributeString("valid-key", "value");
      span.end();

      expect(signalProcessor.trackedSpans.length, 1);
      expect(signalProcessor.trackedSpans.first.userDefinedAttrs.containsKey(longKey), false);
      expect(signalProcessor.trackedSpans.first.userDefinedAttrs.containsKey("valid-key"), true);
    });

    test("removes invalid user-defined attributes by value length", () {
      spanProcessor.onConfigLoaded();

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
      spanProcessor.onStart(span);

      final longValue = "v" * (configProvider.maxUserDefinedAttributeValueLength + 1);
      span.setAttributeString("invalid-value-key", longValue);
      span.setAttributeString("valid-key", "value");
      span.end();

      expect(signalProcessor.trackedSpans.length, 1);
      expect(signalProcessor.trackedSpans.first.userDefinedAttrs.containsKey("invalid-value-key"), false);
      expect(signalProcessor.trackedSpans.first.userDefinedAttrs.containsKey("valid-key"), true);
    });

    test("limits number of user-defined attributes per span", () {
      spanProcessor.onConfigLoaded();

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
      spanProcessor.onStart(span);

      // Add more attributes than allowed
      for (int i = 0; i < configProvider.maxUserDefinedAttributesPerEvent + 5; i++) {
        span.setAttributeString("key-$i", "value-$i");
      }
      span.end();

      expect(signalProcessor.trackedSpans.length, 1);
      expect(
        signalProcessor.trackedSpans.first.userDefinedAttrs.length,
        configProvider.maxUserDefinedAttributesPerEvent,
      );
    });

    test("removes invalid spans from buffer before config loads", () {
      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessor,
        timeProvider: timeProvider,
        isSampled: true,
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() + 1000, // Negative duration
      );
      spanProcessor.onStart(span);
      span.end();

      spanProcessor.onConfigLoaded();

      expect(signalProcessor.trackedSpans.length, 0);
    });

    test("handles empty buffer on config load", () {
      spanProcessor.onConfigLoaded();

      // Should not throw
      expect(signalProcessor.trackedSpans.length, 0);
    });

    test("applies sampling decision when config loads", () {
      final customSampler = FakeSampler();
      customSampler.overrideShouldSampleTrace = true;

      final spanProcessorWithSampler = MsrSpanProcessor(
        logger,
        signalProcessor,
        configProvider,
        customSampler,
      );

      final span = MsrSpan(
        logger: logger,
        spanProcessor: spanProcessorWithSampler,
        timeProvider: timeProvider,
        isSampled: true, // Initially sampled
        name: "span-name",
        spanId: "span-id",
        traceId: "trace-id",
        parentId: null,
        startTime: timeProvider.now() - 1000,
      );
      span.setSamplingRate(false);
      spanProcessorWithSampler.onStart(span);
      span.end();

      spanProcessorWithSampler.onConfigLoaded();

      expect(signalProcessor.trackedSpans.length, 1);
      expect(signalProcessor.trackedSpans.first.isSampled, true);
    });
  });
}