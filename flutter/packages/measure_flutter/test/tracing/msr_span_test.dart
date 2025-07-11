import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/tracing/msr_span.dart';

import '../utils/fake_id_provider.dart';
import '../utils/fake_span_processor.dart';
import '../utils/fake_trace_sampler.dart';
import '../utils/noop_logger.dart';
import '../utils/test_clock.dart';

void main() {
  group('MsrSpan', () {
    late NoopLogger logger;
    late TestClock testClock;
    late FlutterTimeProvider timeProvider;
    late FakeSpanProcessor spanProcessor;
    late FakeTraceSampler traceSampler;
    late FakeIdProvider idProvider;

    setUp(() {
      logger = NoopLogger();
      testClock = TestClock.create();
      timeProvider = FlutterTimeProvider(testClock);
      spanProcessor = FakeSpanProcessor();
      traceSampler = FakeTraceSampler();
      idProvider = FakeIdProvider();
    });

    group('startSpan', () {
      test('sets parent span if provided', () {
        final parentSpan = MsrSpan(
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          isSampled: true,
          name: 'test',
          spanId: 'spanId',
          traceId: 'traceId',
          parentId: 'parentId',
          startTime: 123,
        );

        final span = MsrSpan.startSpan(
          name: 'test',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          parentSpan: parentSpan,
          idProvider: idProvider,
          traceSampler: traceSampler,
        );

        expect(span.parentId, parentSpan.spanId);
      });

      test('sets current timestamp', () {
        final epochTime = testClock.epochTime();
        final span = MsrSpan.startSpan(
          name: 'test',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
          timestamp: null,
        ) as MsrSpan;

        expect(span.startTime, epochTime);
      });

      test('sets timestamp if provided', () {
        final timestamp = 10000;
        final span = MsrSpan.startSpan(
          name: 'test',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
          timestamp: timestamp,
        ) as MsrSpan;

        expect(span.startTime, timestamp);
      });

      test('triggers span processor onStart', () {
        MsrSpan.startSpan(
          name: 'test',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
        );

        expect(spanProcessor.startedSpanCount, 1);
      });

      test('sets sampling state for root span based on trace sampler', () {
        traceSampler.overrideShouldSample = true;
        final span1 = MsrSpan.startSpan(
          name: 'span-name',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        expect(span1.isSampled, true);

        traceSampler.overrideShouldSample = false;
        final span2 = MsrSpan.startSpan(
          name: 'span-name',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        expect(span2.isSampled, false);
      });

      test('samples child span if parent span is sampled', () {
        traceSampler.overrideShouldSample = true;
        final sampledParentSpan = MsrSpan.startSpan(
          name: 'span-name',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        traceSampler.overrideShouldSample = false;
        final childSpan = MsrSpan.startSpan(
          name: 'span-name',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: sampledParentSpan,
        ) as MsrSpan;

        expect(childSpan.isSampled, true);
      });

      test('does not sample child span if parent span is not sampled', () {
        traceSampler.overrideShouldSample = false;
        final unsampledParentSpan = MsrSpan.startSpan(
          name: 'span-name',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        traceSampler.overrideShouldSample = true;
        final childSpan = MsrSpan.startSpan(
          name: 'span-name',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: unsampledParentSpan,
        ) as MsrSpan;

        expect(childSpan.isSampled, false);
      });

      test('initializes parent ID and trace ID correctly', () {
        final parentSpan = MsrSpan.startSpan(
          name: 'parent-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        final childSpan = MsrSpan.startSpan(
          name: 'child-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: parentSpan,
        ) as MsrSpan;

        expect(childSpan.parentId, parentSpan.spanId);
        expect(childSpan.traceId, parentSpan.traceId);
      });
    });

    group('span status', () {
      test('default span status is unset', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        expect(span.getStatus(), SpanStatus.unset);
      });

      test('setStatus updates the span status', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.setStatus(SpanStatus.ok);
        expect(span.getStatus(), SpanStatus.ok);

        span.setStatus(SpanStatus.error);
        expect(span.getStatus(), SpanStatus.error);
      });
    });

    group('span name', () {
      test('setName updates the span name', () {
        final span = MsrSpan.startSpan(
          name: 'original-name',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        expect(span.name, 'original-name');

        span.setName('updated-name');
        expect(span.name, 'updated-name');
      });
    });

    group('span lifecycle', () {
      test('hasEnded for active span', () {
        final span = MsrSpan.startSpan(
          name: 'active-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        expect(span.hasEnded(), false);
      });

      test('hasEnded for ended span', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.end();
        expect(span.hasEnded(), true);
      });
    });

    group('end', () {
      test('updates the span duration', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        // Advance time and end the span
        testClock.advance(Duration(milliseconds: 500));
        span.end();

        expect(span.getDuration(), 500);
      });

      test('triggers span processor onEnding and onEnded', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.end();

        expect(spanProcessor.endingSpanCount, 1);
        expect(spanProcessor.endedSpanCount, 1);
      });

      test('uses the timestamp provided', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        // End the span with explicit timestamp
        span.end(timestamp: testClock.epochTime() + 10000);

        expect(span.getDuration(), 10000);
      });
    });

    group('checkpoints', () {
      test('setCheckpoint adds checkpoint to span', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.setCheckpoint('checkpoint-1');
        span.setCheckpoint('checkpoint-2');

        expect(span.checkpoints.length, 2);
        expect(span.checkpoints[0].name, 'checkpoint-1');
        expect(span.checkpoints[1].name, 'checkpoint-2');
      });

      test('setEvent on ended span is a no-op', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.end();
        final checkpointsBeforeEvent = span.checkpoints.length;

        span.setCheckpoint('event-after-end');

        expect(span.checkpoints.length, checkpointsBeforeEvent);
      });
    });

    group('attributes', () {
      test('setAttribute adds attribute to span', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.setAttributeString('key1', 'value1');
        span.setAttributeInt('key2', 42);

        expect(span.getUserDefinedAttrs()['key1'], 'value1');
        expect(span.getUserDefinedAttrs()['key2'], 42);
      });

      test('setAttribute on ended span is a no-op', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.setAttributeString('before-end', 'value');
        span.end();

        final attributesBeforeSet = Map.from(span.attributes);
        span.setAttributeString('after-end', 'value');

        expect(span.attributes, attributesBeforeSet);
        expect(span.attributes.containsKey('after-end'), false);
      });

      test('setAttributes adds multiple attributes to span', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        final attributes = {
          'key1': StringAttr('value1'),
          'key2': StringAttr('value2'),
          'key3': IntAttr(123),
        };

        span.setAttributes(attributes);

        expect(span.getUserDefinedAttrs()['key1'], 'value1');
        expect(span.getUserDefinedAttrs()['key2'], 'value2');
        expect(span.getUserDefinedAttrs()['key3'], 123);
      });

      test('removeAttribute removes attribute from span', () {
        final span = MsrSpan.startSpan(
          name: 'test-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        span.setAttributeString('key1', 'value1');
        span.setAttributeString('key2', 'value2');

        expect(span.getUserDefinedAttrs().containsKey('key1'), true);

        span.removeAttribute('key1');

        expect(span.getUserDefinedAttrs().containsKey('key1'), false);
        expect(span.getUserDefinedAttrs().containsKey('key2'), true);
      });
    });

    group('duration', () {
      test('is 0 for active span', () {
        final span = MsrSpan.startSpan(
          name: 'active-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        expect(span.getDuration(), 0);
      });
    });

    group('parent relationship', () {
      test('setParent updates parent ID and trace ID correctly', () {
        final parentSpan = MsrSpan.startSpan(
          name: 'parent-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        final childSpan = MsrSpan.startSpan(
          name: 'child-span',
          logger: logger,
          spanProcessor: spanProcessor,
          timeProvider: timeProvider,
          idProvider: idProvider,
          traceSampler: traceSampler,
          parentSpan: null,
        ) as MsrSpan;

        childSpan.setParent(parentSpan);

        expect(childSpan.parentId, parentSpan.spanId);
        expect(childSpan.traceId, parentSpan.traceId);
      });
    });
  });
}
