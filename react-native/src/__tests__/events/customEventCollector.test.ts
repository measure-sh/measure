import { CustomEventCollector } from '../../events/customEventCollector';
import { EventType } from '../../events/eventType';
import { validateAttributes } from '../../utils/attributeValueValidator';

jest.mock('../../utils/attributeValueValidator', () => ({
  validateAttributes: jest.fn(),
}));

describe('CustomEventCollector', () => {
  let logger: { log: jest.Mock };
  let timeProvider: { now: jest.Mock };
  let configProvider: {
    maxEventNameLength: number;
    customEventNameRegex: string;
  };
  let signalProcessor: { trackEvent: jest.Mock };
  let collector: CustomEventCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn() };
    timeProvider = { now: jest.fn(() => 123456789) };
    configProvider = {
      maxEventNameLength: 10,
      customEventNameRegex: '^[a-zA-Z0-9_]+$',
    };
    signalProcessor = { trackEvent: jest.fn().mockResolvedValue(undefined) };

    (validateAttributes as jest.Mock).mockReturnValue(true);

    collector = new CustomEventCollector({
      logger: logger as any,
      timeProvider: timeProvider as any,
      configProvider: configProvider as any,
      signalProcessor: signalProcessor as any,
    });
    collector.register();
  });

  it('does nothing when disabled', async () => {
    collector.unregister();
    await collector.trackCustomEvent('test');
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs error if name is empty', async () => {
    await collector.trackCustomEvent('');
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid event: name is empty'
    );
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });

  it('logs error if name is too long', async () => {
    await collector.trackCustomEvent('toolongnamehere');
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid event(toolongnamehere): exceeds maximum length of 10 characters'
    );
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });

  it('logs error if name fails regex', async () => {
    await collector.trackCustomEvent('bad-name!');
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid event(bad-name!) format'
    );
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });

  it('does not track event when attributes are invalid', async () => {
    (validateAttributes as jest.Mock).mockReturnValueOnce(false);
    const attrs = { good: 'ok', bad: { nested: true } } as any;

    await collector.trackCustomEvent('event1', attrs, 111);

    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid attributes provided for event(event1). Dropping the event.'
    );
  });

  it('tracks valid custom event successfully', async () => {
    const attrs = { key1: { type: 'string', value: 'abc' } } as any;

    await collector.trackCustomEvent('validEvent', attrs);

    expect(signalProcessor.trackEvent).toHaveBeenCalledWith(
      { name: 'validEvent' },
      EventType.Custom,
      123456789,
      {},
      attrs,
      true,
      undefined,
      undefined,
      []
    );

    expect(logger.log).toHaveBeenCalledWith(
      'info',
      'Successfully tracked custom event: validEvent'
    );
  });

  it('logs error if signalProcessor.trackEvent throws', async () => {
    signalProcessor.trackEvent.mockRejectedValueOnce(new Error('boom'));

    await collector.trackCustomEvent('event2');

    expect(logger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining(
        'Failed to track custom event event2: Error: boom'
      )
    );
  });

  it('isEnabled returns correct value', () => {
    expect(collector.isEnabled()).toBe(true);
    collector.unregister();
    expect(collector.isEnabled()).toBe(false);
  });
});
