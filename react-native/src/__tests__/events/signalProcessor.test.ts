import { SignalProcessor } from '../../events/signalProcessor';
import { trackEvent, trackSpan } from '../../native/measureBridge';
import type { SpanData } from '../../tracing/spanData';

jest.mock('../../native/measureBridge', () => ({
  trackEvent: jest.fn(() => Promise.resolve()),
  trackSpan: jest.fn(() => Promise.resolve()),
}));

const ATTRIBUTES_ARG_INDEX = 3;

function makeSpanData(attributes?: Record<string, any>): SpanData {
  return {
    name: 'span',
    traceId: 'trace-id',
    spanId: 'span-id',
    startTime: 1,
    endTime: 2,
    duration: 1,
    status: 0 as any,
    attributes,
    checkpoints: [],
    hasEnded: true,
    isSampled: true,
  };
}

describe('SignalProcessor framework attributes', () => {
  let logger: { log: jest.Mock; internalLog: jest.Mock };
  let processor: SignalProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn(), internalLog: jest.fn() };
    processor = new SignalProcessor(logger as any);
  });

  it('passes attributes through untouched when none are set', async () => {
    await processor.trackEvent({}, 'custom', 1, { existing: 'value' });

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(
      (trackEvent as jest.Mock).mock.calls[0][ATTRIBUTES_ARG_INDEX]
    ).toEqual({ existing: 'value' });
  });

  it('merges framework attributes into every tracked event', async () => {
    processor.setFrameworkAttributes({
      expo_update_id: 'update-id',
      is_expo_embedded_launch: false,
      patch_id: 'patch-id',
    });

    await processor.trackEvent({}, 'custom', 1, { existing: 'value' });

    expect(
      (trackEvent as jest.Mock).mock.calls[0][ATTRIBUTES_ARG_INDEX]
    ).toEqual({
      existing: 'value',
      expo_update_id: 'update-id',
      is_expo_embedded_launch: false,
      patch_id: 'patch-id',
    });
  });

  it('merges framework attributes into every tracked span', async () => {
    processor.setFrameworkAttributes({ expo_sdk_version: '56.0.0' });

    await processor.trackSpan(makeSpanData({ existing: 'value' }));

    expect(trackSpan).toHaveBeenCalledTimes(1);
    // trackSpan receives attributes as its 9th positional argument.
    expect((trackSpan as jest.Mock).mock.calls[0][8]).toEqual({
      existing: 'value',
      expo_sdk_version: '56.0.0',
    });
  });

  it('applies framework attributes to spans with no attributes of their own', async () => {
    processor.setFrameworkAttributes({ expo_sdk_version: '56.0.0' });

    await processor.trackSpan(makeSpanData(undefined));

    expect((trackSpan as jest.Mock).mock.calls[0][8]).toEqual({
      expo_sdk_version: '56.0.0',
    });
  });

  it('lets framework attributes take precedence over per-signal attributes', async () => {
    processor.setFrameworkAttributes({ patch_id: 'framework-patch' });

    await processor.trackEvent({}, 'custom', 1, { patch_id: 'signal-patch' });

    expect(
      (trackEvent as jest.Mock).mock.calls[0][ATTRIBUTES_ARG_INDEX].patch_id
    ).toBe('framework-patch');
  });

  it('does not mutate the caller-supplied attributes object', async () => {
    processor.setFrameworkAttributes({ expo_version: '56.0.9' });
    const attributes = { existing: 'value' };

    await processor.trackEvent({}, 'custom', 1, attributes);

    expect(attributes).toEqual({ existing: 'value' });
  });

  it('replaces previously set framework attributes', async () => {
    processor.setFrameworkAttributes({ expo_update_id: 'first' });
    processor.setFrameworkAttributes({ expo_update_id: 'second' });

    await processor.trackEvent({}, 'custom', 1);

    expect(
      (trackEvent as jest.Mock).mock.calls[0][ATTRIBUTES_ARG_INDEX]
    ).toEqual({ expo_update_id: 'second' });
  });

  it('keeps a copy so later mutations of the source map are ignored', async () => {
    const source: Record<string, any> = { expo_version: '56.0.9' };
    processor.setFrameworkAttributes(source);
    source.expo_version = 'mutated';

    await processor.trackEvent({}, 'custom', 1);

    expect(
      (trackEvent as jest.Mock).mock.calls[0][ATTRIBUTES_ARG_INDEX].expo_version
    ).toBe('56.0.9');
  });
});
