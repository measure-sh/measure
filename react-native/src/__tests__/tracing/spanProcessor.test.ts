import { SpanProcessor } from '../../tracing/spanProcessor';
import { MsrSpan } from '../../tracing/msrSpan';

describe('SpanProcessor', () => {
  let mockLogger: any;
  let mockSignalProcessor: any;
  let mockConfigProvider: any;
  let processor: SpanProcessor;
  let mockTimeProvider: any;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
    };
    mockSignalProcessor = {
      trackSpan: jest.fn(),
    };
    mockConfigProvider = {
      maxSpanNameLength: 50,
      maxCheckpointNameLength: 10,
      maxCheckpointsPerSpan: 3,
    };
    processor = new SpanProcessor(mockLogger, mockSignalProcessor, mockConfigProvider);

    mockTimeProvider = {
      now: jest.fn(() => 1000),
      iso8601Timestamp: jest.fn((t) => `ts-${t}`),
    };
  });

  const createSpan = (name = 'test-span') =>
    new MsrSpan(
      mockTimeProvider,
      true,
      name,
      's1',
      't1',
      undefined,
      0,
      processor
    );

  it('calls logger and sets internal attribute on start', () => {
    const span = createSpan();
    processor.onStart(span);

    expect(mockLogger.log).toHaveBeenCalledWith(
      'debug',
      `Span started: ${span.name}`,
      null,
      { step: 'onStart' }
    );

    expect(span.attributes).toEqual({ thread_name: 'rn_main' });
  });

  it('tracks valid span on end', () => {
    const span = createSpan('valid-span');
    span.setCheckpoint('phase1');
    span.end(2000);

    processor.onEnded(span);

    // should log "Span ending"
    expect(mockLogger.log).toHaveBeenCalledWith(
      'debug',
      `Span ending: ${span.name}`,
      null,
      { step: 'onEnded' }
    );

    expect(mockSignalProcessor.trackSpan).toHaveBeenCalled();
    const tracked = mockSignalProcessor.trackSpan.mock.calls[0][0];
    expect(tracked.name).toBe('valid-span');
    expect(tracked.duration).toBe(2000);
  });

  it('drops invalid span when duration < 0', () => {
    const span = createSpan('invalid-span');
    span.startTime = 2000;
    span.endTime = 1000;
    span.end();

    processor.onEnded(span);

    expect(mockLogger.log).toHaveBeenCalledWith(
      'error',
      `Invalid span: invalid-span, duration is negative, span will be dropped`,
      null,
      { duration: -1000 }
    );
    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('drops span if name exceeds max length', () => {
    const longName = 'x'.repeat(100);
    const span = createSpan(longName);
    span.end(2000);

    processor.onEnded(span);

    expect(mockLogger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('length 100 exceeded max allowed'),
      null,
      { maxLength: mockConfigProvider.maxSpanNameLength }
    );
    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('drops checkpoints with too-long names', () => {
    const span = createSpan('checkpoints-test');
    span.checkpoints = [
      { name: 'valid', timestamp: 't1' },
      { name: 'toolongcheckpointname', timestamp: 't2' },
    ];
    span.end(2000);

    processor.onEnded(span);

    expect(mockLogger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('dropped 1 checkpoints'),
      null,
      { droppedCount: 1 }
    );
    const tracked = mockSignalProcessor.trackSpan.mock.calls[0][0];
    expect(tracked.checkpoints).toHaveLength(1);
    expect(tracked.checkpoints[0].name).toBe('valid');
  });

  it('limits number of checkpoints to maxCheckpointsPerSpan', () => {
    const span = createSpan('overflow-checkpoints');
    span.checkpoints = [
      { name: 'a', timestamp: 't1' },
      { name: 'b', timestamp: 't2' },
      { name: 'c', timestamp: 't3' },
      { name: 'd', timestamp: 't4' },
    ];
    span.end(2000);

    processor.onEnded(span);

    expect(mockLogger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('max checkpoints exceeded'),
      null,
      { maxAllowed: mockConfigProvider.maxCheckpointsPerSpan }
    );
    const tracked = mockSignalProcessor.trackSpan.mock.calls[0][0];
    expect(tracked.checkpoints.length).toBe(3);
  });

  it('logs span ended message with duration', () => {
    const span = createSpan('end-log');
    span.end(2000);

    processor.onEnded(span);

    expect(mockLogger.log).toHaveBeenCalledWith(
      'debug',
      `Span ended: end-log, duration: ${span.endTime - span.startTime}`,
      null,
      { duration: span.endTime - span.startTime }
    );
  });
});
