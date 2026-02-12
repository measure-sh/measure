import { SpanProcessor } from '../../tracing/spanProcessor';
import { MsrSpan } from '../../tracing/msrSpan';

describe('SpanProcessor', () => {
  let mockLogger: any;
  let mockSignalProcessor: any;
  let mockConfigProvider: any;
  let mockTraceSampler: any;
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
      maxSpanNameLength: 20,
      maxCheckpointNameLength: 10,
      maxCheckpointsPerSpan: 3,
    };

    mockTraceSampler = {
      shouldSampleTrace: jest.fn(() => true),
    };

    processor = new SpanProcessor(
      mockLogger,
      mockSignalProcessor,
      mockConfigProvider,
      mockTraceSampler
    );

    mockTimeProvider = {
      now: jest.fn(() => 1000),
      iso8601Timestamp: jest.fn((t) => `ts-${t}`),
    };
  });

  const createSpan = (name = 'span-name') =>
    new MsrSpan(
      mockTimeProvider,
      true,
      name,
      'span-id',
      'trace-id',
      undefined,
      0,
      processor
    );

  it('adds thread name attribute on start', () => {
    const span = createSpan();
    processor.onStart(span);

    expect(span.attributes?.thread_name).toBe('rn_main');
  });

  it('buffers spans before config is loaded', () => {
    const span = createSpan();

    processor.onStart(span);
    span.end(2000);

    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('processes buffered spans after config loads', () => {
    const span = createSpan('buffered-span');

    processor.onStart(span);
    span.end(2000);

    processor.onConfigLoaded();

    expect(mockSignalProcessor.trackSpan).toHaveBeenCalledTimes(1);
    expect(mockSignalProcessor.trackSpan.mock.calls[0][0].name).toBe(
      'buffered-span'
    );
  });

  it('processes only ended spans when config loads', () => {
    const endedSpan = createSpan('ended');
    const openSpan = createSpan('open');

    processor.onStart(endedSpan);
    endedSpan.end(2000);

    processor.onStart(openSpan);

    processor.onConfigLoaded();

    expect(mockSignalProcessor.trackSpan).toHaveBeenCalledTimes(1);
    expect(mockSignalProcessor.trackSpan.mock.calls[0][0].name).toBe('ended');
  });

  it('delegates directly to signal processor when config already loaded', () => {
    processor.onConfigLoaded();

    const span = createSpan('immediate');

    processor.onStart(span);
    span.end(2000);

    expect(mockSignalProcessor.trackSpan).toHaveBeenCalledTimes(1);
    expect(mockSignalProcessor.trackSpan.mock.calls[0][0].name).toBe('immediate');
  });

  it('drops span if name exceeds max length', () => {
    const longName = 'x'.repeat(mockConfigProvider.maxSpanNameLength + 1);
    const span = createSpan(longName);

    processor.onStart(span);
    span.end(2000);
    processor.onConfigLoaded();

    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('drops span with blank name', () => {
    const span = createSpan('   ');

    processor.onStart(span);
    span.end(2000);
    processor.onConfigLoaded();

    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('drops checkpoint if checkpoint name exceeds max length', () => {
    const span = createSpan();

    processor.onStart(span);
    span.setCheckpoint('valid');
    span.setCheckpoint('toolongcheckpoint');
    span.end(2000);

    processor.onConfigLoaded();

    const tracked = mockSignalProcessor.trackSpan.mock.calls[0][0];
    expect(tracked.checkpoints).toHaveLength(1);
    expect(tracked.checkpoints[0].name).toBe('valid');
  });

  it('limits checkpoints to maxCheckpointsPerSpan', () => {
    const span = createSpan();

    processor.onStart(span);
    span.setCheckpoint('a');
    span.setCheckpoint('b');
    span.setCheckpoint('c');
    span.setCheckpoint('d'); // exceeds limit
    span.end(2000);

    processor.onConfigLoaded();

    const tracked = mockSignalProcessor.trackSpan.mock.calls[0][0];
    expect(tracked.checkpoints.length).toBe(
      mockConfigProvider.maxCheckpointsPerSpan
    );
  });

  it('drops span if duration is negative', () => {
    const span = createSpan();

    processor.onStart(span);
    span.startTime = 2000;
    span.endTime = 1000;
    span.end();

    processor.onConfigLoaded();

    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('removes invalid spans from buffer before config loads', () => {
    const span = createSpan();

    processor.onStart(span);
    span.startTime = 2000;
    span.endTime = 1000;
    span.end();

    processor.onConfigLoaded();

    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('handles empty buffer on config load', () => {
    expect(() => processor.onConfigLoaded()).not.toThrow();
    expect(mockSignalProcessor.trackSpan).not.toHaveBeenCalled();
  });

  it('applies sampling decision when config loads', () => {
    const span = createSpan();

    processor.onStart(span);
    span.end(2000);

    processor.onConfigLoaded();

    expect(mockTraceSampler.shouldSampleTrace).toHaveBeenCalledWith('trace-id');
    expect(span.isSampled).toBe(true);
  });

  it('logs final span ended message with duration', () => {
    const span = createSpan('log-span');

    processor.onStart(span);
    span.end(2000);
    processor.onConfigLoaded();

    expect(mockLogger.log).toHaveBeenCalledWith(
      'debug',
      `Span ended: log-span, duration: 2000`,
      null,
      { duration: 2000 }
    );
  });
});