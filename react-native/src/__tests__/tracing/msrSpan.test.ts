import { MsrSpan } from '../../tracing/msrSpan';
import { SpanStatus } from '../../tracing/spanStatus';

describe('MsrSpan', () => {
  let mockTimeProvider: any;
  let mockIdProvider: any;
  let mockTraceSampler: any;
  let mockSpanProcessor: any;

  beforeEach(() => {
    mockTimeProvider = {
      now: jest.fn(() => 1000),
      iso8601Timestamp: jest.fn((t) => `ts-${t}`),
    };
    mockIdProvider = {
      spanId: jest.fn(() => 'span-123'),
      traceId: jest.fn(() => 'trace-xyz'),
    };
    mockTraceSampler = {
      shouldSample: jest.fn(() => true),
    };
    mockSpanProcessor = {
      onStart: jest.fn(),
      onEnding: jest.fn(),
      onEnded: jest.fn(),
    };
  });

  describe('startSpan', () => {
    it('creates and starts a new span', () => {
      const span = MsrSpan.startSpan({
        name: 'test-span',
        timeProvider: mockTimeProvider,
        idProvider: mockIdProvider,
        traceSampler: mockTraceSampler,
        spanProcessor: mockSpanProcessor,
      });

      expect(span.spanId).toBe('span-123');
      expect(span.traceId).toBe('trace-xyz');
      expect(span.isSampled).toBe(true);
      expect(mockSpanProcessor.onStart).toHaveBeenCalledWith(span);
    });

    it('inherits traceId and sampled state from parent', () => {
      const parentSpan: any = {
        spanId: 'parent-span',
        traceId: 'parent-trace',
        isSampled: false,
      };

      const span = MsrSpan.startSpan({
        name: 'child-span',
        timeProvider: mockTimeProvider,
        idProvider: mockIdProvider,
        traceSampler: mockTraceSampler,
        spanProcessor: mockSpanProcessor,
        parentSpan,
      });

      expect(span.parentId).toBe('parent-span');
      expect(span.traceId).toBe('parent-trace');
      expect(span.isSampled).toBe(false);
    });
  });

  describe('attribute handling', () => {
    let span: MsrSpan;

    beforeEach(() => {
      span = new MsrSpan(
        mockTimeProvider,
        true,
        'span',
        's1',
        't1',
        undefined,
        0,
        mockSpanProcessor
      );
    });

    it('sets internal attributes', () => {
      span.setInternalAttribute({ foo: 'bar' });
      expect(span.attributes).toEqual({ foo: 'bar' });
    });

    it('sets and removes user-defined attributes', () => {
      span.setAttribute('key1', 'value1');
      expect(span.getUserDefinedAttrs()).toBeDefined();
      expect(span.getUserDefinedAttrs()?.['key1']).toBe('value1');

      span.removeAttribute('key1');
      expect(span.getUserDefinedAttrs()['key1']).toBeUndefined();
    });

    it('sets multiple attributes', () => {
      span.setAttributes({
        a: 'A',
        b: 42,
      });
      expect(Object.keys(span.getUserDefinedAttrs())).toContain('a');
      expect(Object.keys(span.getUserDefinedAttrs())).toContain('b');
    });

    it('does not mutate after end', () => {
      span.end(2000);
      span.setAttribute('x', 'y');
      span.setStatus(SpanStatus.Ok);
      expect(span.getUserDefinedAttrs()['x']).toBeUndefined();
      expect(span.getStatus()).toBe(SpanStatus.Unset);
    });
  });

  describe('checkpoints', () => {
    it('adds checkpoints before end', () => {
      const span = new MsrSpan(
        mockTimeProvider,
        true,
        's',
        's1',
        't1',
        undefined,
        0,
        mockSpanProcessor
      );
      span.setCheckpoint('phase1');
      expect(span.checkpoints).toEqual([{ name: 'phase1', timestamp: 'ts-1000' }]);
    });

    it('ignores checkpoints after end', () => {
      const span = new MsrSpan(
        mockTimeProvider,
        true,
        's',
        's1',
        't1',
        undefined,
        0,
        mockSpanProcessor
      );
      span.end(2000);
      span.setCheckpoint('ignored');
      expect(span.checkpoints).toHaveLength(0);
    });
  });

  describe('lifecycle', () => {
    it('calls onEnding and onEnded when ended', () => {
      const span = new MsrSpan(
        mockTimeProvider,
        true,
        's',
        's1',
        't1',
        undefined,
        0,
        mockSpanProcessor
      );

      span.end(2000);

      expect(span.hasEnded()).toBe(true);
      expect(mockSpanProcessor.onEnding).toHaveBeenCalledWith(span);
      expect(mockSpanProcessor.onEnded).toHaveBeenCalledWith(span);
      expect(span.getDuration()).toBe(2000);
    });

    it('does not end twice', () => {
      const span = new MsrSpan(
        mockTimeProvider,
        true,
        's',
        's1',
        't1',
        undefined,
        0,
        mockSpanProcessor
      );

      span.end(1000);
      span.end(2000);
      expect(mockSpanProcessor.onEnding).toHaveBeenCalledTimes(1);
      expect(mockSpanProcessor.onEnded).toHaveBeenCalledTimes(1);
    });
  });

  describe('toSpanData', () => {
    it('returns correct span data', () => {
      const span = new MsrSpan(
        mockTimeProvider,
        true,
        's',
        's1',
        't1',
        undefined,
        10,
        mockSpanProcessor
      );
      span.setAttribute('k', 'v');
      span.setCheckpoint('cp');
      span.end(1010);

      const data = span.toSpanData();

      expect(data.name).toBe('s');
      expect(data.duration).toBe(1000);
      expect(data.hasEnded).toBe(true);
      expect(data.userDefinedAttrs).toBeDefined();
      expect(data.userDefinedAttrs?.['k']).toBe('v');
      expect(data.checkpoints.length).toBe(1);
    });
  });
});
