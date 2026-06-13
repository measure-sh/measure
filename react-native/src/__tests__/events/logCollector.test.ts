import { LogCollector } from '../../events/logCollector';
import { EventType } from '../../events/eventType';
import { LogSeverity } from '../../events/logSeverity';
import { validateAttributes } from '../../utils/attributeValueValidator';

jest.mock('../../utils/attributeValueValidator', () => ({
  validateAttributes: jest.fn(),
}));

describe('LogCollector', () => {
  let logger: { log: jest.Mock };
  let timeProvider: { now: jest.Mock };
  let configProvider: { maxLogMessageLength: number; minLogSeverityNumber: number };
  let signalProcessor: { trackEvent: jest.Mock };
  let collector: LogCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn(), internalLog: jest.fn() } as any;
    timeProvider = { now: jest.fn(() => 123456789) };
    configProvider = { maxLogMessageLength: 4000, minLogSeverityNumber: 8 };
    signalProcessor = { trackEvent: jest.fn().mockResolvedValue(undefined) };

    (validateAttributes as jest.Mock).mockReturnValue(true);

    collector = new LogCollector({
      logger: logger as any,
      timeProvider: timeProvider as any,
      configProvider: configProvider as any,
      signalProcessor: signalProcessor as any,
    });
    collector.register();
  });

  it('does nothing when disabled', async () => {
    collector.unregister();
    await collector.trackLog({ body: 'test' });
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs error if body is empty', async () => {
    await collector.trackLog({ body: '' });
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid log: body is empty'
    );
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });

  it('does not track log when attributes are invalid', async () => {
    (validateAttributes as jest.Mock).mockReturnValueOnce(false);
    const attrs = { good: 'ok', bad: { nested: true } } as any;

    await collector.trackLog({
      body: 'log message',
      attributes: attrs,
      timestamp: 111,
    });

    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid attributes provided for log. Dropping the event.'
    );
  });

  it('tracks valid log successfully', async () => {
    const attrs = { key1: 'value1' } as any;

    await collector.trackLog({
      body: 'log message',
      severity: LogSeverity.Error,
      attributes: attrs,
    });

    expect(signalProcessor.trackEvent).toHaveBeenCalledWith(
      { severity_text: 'error', severity_number: 20, body: 'log message' },
      EventType.Log,
      123456789,
      {},
      attrs,
      true,
      undefined,
      undefined,
      []
    );

    expect(logger.log).toHaveBeenCalledWith('info', 'Successfully tracked log');
  });

  it('defaults severity to info', async () => {
    await collector.trackLog({ body: 'log message' });

    expect(signalProcessor.trackEvent).toHaveBeenCalledWith(
      { severity_text: 'info', severity_number: 12, body: 'log message' },
      EventType.Log,
      123456789,
      {},
      undefined,
      true,
      undefined,
      undefined,
      []
    );
  });

  it('truncates body exceeding max length', async () => {
    const body = 'a'.repeat(5000);

    await collector.trackLog({ body });

    expect(signalProcessor.trackEvent).toHaveBeenCalledWith(
      { severity_text: 'info', severity_number: 12, body: 'a'.repeat(4000) },
      EventType.Log,
      123456789,
      {},
      undefined,
      true,
      undefined,
      undefined,
      []
    );
  });

  it('uses provided timestamp', async () => {
    await collector.trackLog({ body: 'log message', timestamp: 999 });

    expect(signalProcessor.trackEvent).toHaveBeenCalledWith(
      { severity_text: 'info', severity_number: 12, body: 'log message' },
      EventType.Log,
      999,
      {},
      undefined,
      true,
      undefined,
      undefined,
      []
    );
  });

  it('logs error if signalProcessor.trackEvent throws', async () => {
    signalProcessor.trackEvent.mockRejectedValueOnce(new Error('boom'));

    await collector.trackLog({ body: 'log message' });

    expect(logger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Failed to track log: Error: boom')
    );
  });

  it('drops logs below the configured minimum level', async () => {
    configProvider.minLogSeverityNumber = 16;

    await collector.trackLog({ body: 'debug message', severity: LogSeverity.Debug });
    await collector.trackLog({ body: 'info message', severity: LogSeverity.Info });

    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });

  it('tracks logs at or above the configured minimum level', async () => {
    configProvider.minLogSeverityNumber = 16;

    await collector.trackLog({ body: 'warn message', severity: LogSeverity.Warning });
    await collector.trackLog({ body: 'error message', severity: LogSeverity.Error });

    expect(signalProcessor.trackEvent).toHaveBeenCalledTimes(2);
  });

  it('isEnabled returns correct value', () => {
    expect(collector.isEnabled()).toBe(true);
    collector.unregister();
    expect(collector.isEnabled()).toBe(false);
  });
});
