import { EventType } from '../../events/eventType';
import { UserTriggeredEventCollector } from '../../events/userTriggeredEventCollector';
import { trackHttpEvent } from '../../native/measureBridge';

jest.mock('../../native/measureBridge', () => ({
  trackHttpEvent: jest.fn(() => Promise.resolve()),
}));

describe('UserTriggeredEventCollector', () => {
  let logger: { log: jest.Mock; internalLog: jest.Mock };
  let signalProcessor: { trackEvent: jest.Mock };
  let collector: UserTriggeredEventCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn(), internalLog: jest.fn() };
    signalProcessor = { trackEvent: jest.fn().mockResolvedValue(undefined) };

    collector = new UserTriggeredEventCollector({
      logger: logger as any,
      timeProvider: { now: jest.fn(() => 1000) } as any,
      signalProcessor: signalProcessor as any,
    });
    collector.register();
  });

  describe('trackScreenView', () => {
    it('tracks a screen view', async () => {
      await collector.trackScreenView({ screenName: 'Home' });

      expect(signalProcessor.trackEvent).toHaveBeenCalledWith(
        { name: 'Home' },
        EventType.ScreenView,
        1000,
        {},
        undefined,
        true,
        undefined,
        undefined,
        []
      );
    });

    it('tracks a screen view name of 1024 characters', async () => {
      await collector.trackScreenView({ screenName: 's'.repeat(1024) });

      expect(signalProcessor.trackEvent).toHaveBeenCalledTimes(1);
    });

    it('drops a screen view name longer than 1024 characters', async () => {
      await collector.trackScreenView({ screenName: 's'.repeat(1025) });

      expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(
        'error',
        'Invalid screen view: name exceeds maximum length of 1024 characters'
      );
    });
  });

  describe('trackHttpEvent', () => {
    const httpEvent = {
      url: 'https://api.example.com',
      method: 'GET',
      startTime: 1000,
      endTime: 1150,
      statusCode: 200,
    };

    it('tracks an HTTP event with a client of 32 characters', async () => {
      await collector.trackHttpEvent({ ...httpEvent, client: 'c'.repeat(32) });

      expect(trackHttpEvent).toHaveBeenCalledTimes(1);
    });

    it('drops an HTTP event with a client longer than 32 characters', async () => {
      await collector.trackHttpEvent({ ...httpEvent, client: 'c'.repeat(33) });

      expect(trackHttpEvent).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(
        'error',
        'Invalid HTTP event: client exceeds maximum length of 32 characters'
      );
    });

    it('tracks an HTTP event without a client', async () => {
      await collector.trackHttpEvent({ ...httpEvent, client: null });

      expect(trackHttpEvent).toHaveBeenCalledTimes(1);
    });
  });
});
