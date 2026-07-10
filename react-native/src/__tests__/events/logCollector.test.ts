import { LogCollector } from '../../events/logCollector';
import { EventType } from '../../events/eventType';
import { LogSeverity } from '../../events/logSeverity';
import { validateAttributes } from '../../utils/attributeValueValidator';
import { MeasureLogger } from '../../utils/logger';
import { internalConsole } from '../../utils/internalConsole';

jest.mock('../../utils/attributeValueValidator', () => ({
  validateAttributes: jest.fn(),
}));

describe('LogCollector', () => {
  let logger: { log: jest.Mock; internalLog: jest.Mock };
  let timeProvider: { now: jest.Mock };
  let configProvider: {
    maxLogBodyLength: number;
    logAutocollectEnabled: boolean;
    logMinSeverity: number;
    shouldDiscardLog: (body: string) => boolean;
  };
  let signalProcessor: { trackEvent: jest.Mock };
  let collector: LogCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn(), internalLog: jest.fn() };
    timeProvider = { now: jest.fn(() => 123456789) };
    configProvider = {
      maxLogBodyLength: 4000,
      logAutocollectEnabled: false,
      logMinSeverity: 8,
      shouldDiscardLog: () => false,
    };
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

  afterEach(() => {
    collector.unregister();
  });

  it('does nothing when disabled', () => {
    collector.unregister();
    collector.trackLog({ body: 'test' });
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs error if body is empty', () => {
    collector.trackLog({ body: '' });
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid log: body is empty'
    );
    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });

  it('does not track log when attributes are invalid', () => {
    (validateAttributes as jest.Mock).mockReturnValueOnce(false);
    const attrs = { good: 'ok', bad: { nested: true } } as any;

    collector.trackLog({
      body: 'log message',
      attributes: attrs,
    });

    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Invalid attributes provided for log. Dropping the event.'
    );
  });

  it('tracks valid log successfully', () => {
    const attrs = { key1: 'value1' } as any;

    collector.trackLog({
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
  });

  it('defaults severity to info', () => {
    collector.trackLog({ body: 'log message' });

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

  it('truncates body exceeding max length', () => {
    const body = 'a'.repeat(5000);

    collector.trackLog({ body });

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

  it('logs error if signalProcessor.trackEvent throws', async () => {
    signalProcessor.trackEvent.mockRejectedValueOnce(new Error('boom'));

    collector.trackLog({ body: 'log message' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Failed to track log: Error: boom')
    );
  });

  it('drops logs below the configured minimum level', () => {
    configProvider.logMinSeverity = 16;

    collector.trackLog({ body: 'debug message', severity: LogSeverity.Debug });
    collector.trackLog({ body: 'info message', severity: LogSeverity.Info });

    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });

  it('tracks logs at or above the configured minimum level', () => {
    configProvider.logMinSeverity = 16;

    collector.trackLog({ body: 'warn message', severity: LogSeverity.Warning });
    collector.trackLog({ body: 'error message', severity: LogSeverity.Error });

    expect(signalProcessor.trackEvent).toHaveBeenCalledTimes(2);
  });

  it('drops logs the config filters out by body', () => {
    configProvider.shouldDiscardLog = () => true;

    collector.trackLog({ body: 'this contains a secret value' });

    expect(signalProcessor.trackEvent).not.toHaveBeenCalled();
  });
});

describe('LogCollector - automatic console capture', () => {
  let configProvider: { logAutocollectEnabled: boolean };
  let collector: LogCollector;
  let trackLogSpy: jest.SpyInstance;
  let originalDebug: typeof console.debug;
  let originalLog: typeof console.log;
  let originalInfo: typeof console.info;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  beforeEach(() => {
    originalDebug = console.debug;
    originalLog = console.log;
    originalInfo = console.info;
    originalWarn = console.warn;
    originalError = console.error;
    console.debug = jest.fn();
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    configProvider = { logAutocollectEnabled: true };
    collector = new LogCollector({
      logger: { log: jest.fn(), internalLog: jest.fn() },
      timeProvider: { now: jest.fn(() => 123456789) },
      configProvider,
      signalProcessor: { trackEvent: jest.fn().mockResolvedValue(undefined) },
    } as any);
    trackLogSpy = jest.spyOn(collector, 'trackLog').mockImplementation(() => {});
  });

  afterEach(() => {
    collector.unregister();
    console.debug = originalDebug;
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it('tracks console output with mapped severity and userTriggered false', () => {
    collector.register();

    console.debug('a debug');
    console.log('a log');
    console.info('an info');
    console.warn('a warning');
    console.error('an error');

    expect(trackLogSpy).toHaveBeenCalledWith({
      body: 'a debug',
      severity: LogSeverity.Debug,
      userTriggered: false,
    });
    expect(trackLogSpy).toHaveBeenCalledWith({
      body: 'a log',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
    expect(trackLogSpy).toHaveBeenCalledWith({
      body: 'an info',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
    expect(trackLogSpy).toHaveBeenCalledWith({
      body: 'a warning',
      severity: LogSeverity.Warning,
      userTriggered: false,
    });
    expect(trackLogSpy).toHaveBeenCalledWith({
      body: 'an error',
      severity: LogSeverity.Error,
      userTriggered: false,
    });
  });

  it('does not capture but keeps console working when collection is disabled', () => {
    configProvider.logAutocollectEnabled = false;
    const original = console.log as jest.Mock;
    collector.register();

    console.log('a log');

    expect(trackLogSpy).not.toHaveBeenCalled();
    expect(original).toHaveBeenCalledWith('a log');
  });

  it('stops capturing when automatic collection is disabled at runtime', () => {
    collector.register();
    console.log('before');
    expect(trackLogSpy).toHaveBeenCalledTimes(1);

    configProvider.logAutocollectEnabled = false;

    console.log('after');
    expect(trackLogSpy).toHaveBeenCalledTimes(1);
  });

  it('starts capturing when automatic collection is enabled at runtime', () => {
    configProvider.logAutocollectEnabled = false;
    collector.register();
    console.log('while disabled');
    expect(trackLogSpy).not.toHaveBeenCalled();

    configProvider.logAutocollectEnabled = true;

    console.log('after enable');
    expect(trackLogSpy).toHaveBeenCalledTimes(1);
  });

  it('invokes the original console method', () => {
    const original = console.log as jest.Mock;
    collector.register();

    console.log('hello', 42);

    expect(original).toHaveBeenCalledWith('hello', 42);
  });

  it('serializes non-string arguments and joins with a space', () => {
    collector.register();

    console.log('count:', 42, { a: 1 }, [1, 2]);

    expect(trackLogSpy).toHaveBeenCalledWith({
      body: 'count: 42 {"a":1} [1,2]',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
  });

  it('skips Error arguments and logs the remaining message', () => {
    collector.register();

    console.error('payment failed', new Error('boom'));

    expect(trackLogSpy).toHaveBeenCalledWith({
      body: 'payment failed',
      severity: LogSeverity.Error,
      userTriggered: false,
    });
  });

  it('does not log when the only argument is an Error', () => {
    collector.register();

    console.error(new Error('boom'));

    expect(trackLogSpy).not.toHaveBeenCalled();
  });

  it('falls back to String for non-serializable arguments', () => {
    collector.register();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    console.log(cyclic);

    expect(trackLogSpy).toHaveBeenCalledWith({
      body: '[object Object]',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
  });

  it('does not capture SDK logger output while patched', () => {
    const savedInfo = console.info as jest.Mock;
    collector.register();
    const sdkLogger = new MeasureLogger('Measure', true, true, false);

    sdkLogger.log('info', 'something happened');

    expect(trackLogSpy).not.toHaveBeenCalled();
    expect(savedInfo).toHaveBeenCalledWith('[Measure] something happened');
  });

  it('captures app messages that look like SDK output', () => {
    collector.register();

    console.info('[Measure] my own message');

    expect(trackLogSpy).toHaveBeenCalledWith({
      body: '[Measure] my own message',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
  });

  it('routes internalConsole to the live console after unregister', () => {
    collector.register();
    collector.unregister();
    const liveWarn = jest.fn();
    console.warn = liveWarn;

    internalConsole.warn('after restore');

    expect(liveWarn).toHaveBeenCalledWith('after restore');
  });

  it('skips empty messages', () => {
    collector.register();

    console.log('');

    expect(trackLogSpy).not.toHaveBeenCalled();
  });

  it('does not capture synchronous re-entrant console calls', () => {
    trackLogSpy.mockImplementation(() => {
      console.log('from inside tracking');
    });
    collector.register();

    console.log('outer');

    expect(trackLogSpy).toHaveBeenCalledTimes(1);
  });

  it('restores original console methods on unregister', () => {
    const patchedTargets = [console.log, console.info];
    collector.register();
    expect(console.log).not.toBe(patchedTargets[0]);

    collector.unregister();

    expect(console.log).toBe(patchedTargets[0]);
    expect(console.info).toBe(patchedTargets[1]);
    console.log('after restore');
    expect(trackLogSpy).not.toHaveBeenCalled();
  });

  it('register is idempotent', () => {
    collector.register();
    collector.register();

    console.log('once');

    expect(trackLogSpy).toHaveBeenCalledTimes(1);
  });
});
