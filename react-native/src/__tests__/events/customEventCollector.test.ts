import { CustomEventCollector } from '../../events/customEventCollector';
import { EventType } from '../../events/eventType';
import { validateAttributes } from '../../utils/attributeValueValidator';

jest.mock('../../native/measureBridge', () => ({
  trackEvent: jest.fn(),
}));

const mockTrackEvent = require('../../native/measureBridge')
  .trackEvent as jest.Mock;

describe('CustomEventCollector', () => {
  let logger: { log: jest.Mock };
  let timeProvider: { now: jest.Mock };
  let configProvider: {
    maxEventNameLength: number;
    customEventNameRegex: string;
  };
  let collector: CustomEventCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn() };
    timeProvider = { now: jest.fn(() => 123456789) };
    configProvider = {
      maxEventNameLength: 10,
      customEventNameRegex: '^[a-zA-Z0-9_]+$',
    };
    collector = new CustomEventCollector({
      logger: logger as any,
      timeProvider: timeProvider as any,
      configProvider: configProvider as any,
    });
    collector.register();
  });

  it('does nothing when disabled', async () => {
    collector.unregister();
    await collector.trackCustomEvent('test');
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs error if name is empty', async () => {
    await collector.trackCustomEvent('');
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid event: name is empty'
    );
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('logs error if name is too long', async () => {
    await collector.trackCustomEvent('toolongnamehere');
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid event(toolongnamehere): exceeds maximum length of 10 characters'
    );
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('logs error if name fails regex', async () => {
    await collector.trackCustomEvent('bad-name!');
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid event(bad-name!) format'
    );
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('tracks event with safe attributes', async () => {
    const attrs = { good: 'ok', bad: { nested: true } } as any;
    await collector.trackCustomEvent('event1', attrs, 111);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      { name: 'event1' },
      EventType.Custom,
      111,
      {}, // attributes param
      validateAttributes(attrs), // safeAttributes
      true,
      undefined,
      undefined,
      []
    );
    expect(logger.log).toHaveBeenCalledWith(
      'info',
      'Successfully tracked custom event: event1'
    );
  });

  it('logs error if nativeTrackEvent throws', async () => {
    mockTrackEvent.mockRejectedValueOnce(new Error('boom'));
    await collector.trackCustomEvent('event2');
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Failed to track custom event event2')
    );
  });
});
