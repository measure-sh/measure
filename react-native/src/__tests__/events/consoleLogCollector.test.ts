import { ConsoleLogCollector } from '../../events/consoleLogCollector';
import { LogSeverity } from '../../events/logSeverity';
import { MeasureLogger } from '../../utils/logger';
import { rawConsole } from '../../utils/rawConsole';

describe('ConsoleLogCollector', () => {
  let logCollector: { trackLog: jest.Mock };
  let collector: ConsoleLogCollector;
  let originalLog: typeof console.log;
  let originalInfo: typeof console.info;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  beforeEach(() => {
    originalLog = console.log;
    originalInfo = console.info;
    originalWarn = console.warn;
    originalError = console.error;
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    logCollector = { trackLog: jest.fn().mockResolvedValue(undefined) };
    collector = new ConsoleLogCollector({ logCollector: logCollector as any });
  });

  afterEach(() => {
    collector.unregister();
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it('tracks console output with mapped severity and userTriggered false', () => {
    collector.register();

    console.log('a log');
    console.info('an info');
    console.warn('a warning');
    console.error('an error');

    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: 'a log',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: 'an info',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: 'a warning',
      severity: LogSeverity.Warning,
      userTriggered: false,
    });
    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: 'an error',
      severity: LogSeverity.Error,
      userTriggered: false,
    });
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

    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: 'count: 42 {"a":1} [1,2]',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
  });

  it('serializes errors using their stack', () => {
    collector.register();
    const error = new Error('boom');

    console.error(error);

    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: error.stack,
      severity: LogSeverity.Error,
      userTriggered: false,
    });
  });

  it('falls back to String for non-serializable arguments', () => {
    collector.register();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    console.log(cyclic);

    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: '[object Object]',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
  });

  it('does not capture SDK logger output while patched', () => {
    const savedInfo = console.info as jest.Mock;
    collector.register();
    const logger = new MeasureLogger('Measure', true, true, false);

    logger.log('info', 'something happened');

    expect(logCollector.trackLog).not.toHaveBeenCalled();
    expect(savedInfo).toHaveBeenCalledWith('[Measure] something happened');
  });

  it('captures app messages that look like SDK output', () => {
    collector.register();

    console.info('[Measure] my own message');

    expect(logCollector.trackLog).toHaveBeenCalledWith({
      body: '[Measure] my own message',
      severity: LogSeverity.Info,
      userTriggered: false,
    });
  });

  it('routes rawConsole to the live console after unregister', () => {
    collector.register();
    collector.unregister();
    const liveWarn = jest.fn();
    console.warn = liveWarn;

    rawConsole.warn('after restore');

    expect(liveWarn).toHaveBeenCalledWith('after restore');
  });

  it('skips empty messages', () => {
    collector.register();

    console.log('');

    expect(logCollector.trackLog).not.toHaveBeenCalled();
  });

  it('does not capture synchronous re-entrant console calls', () => {
    logCollector.trackLog.mockImplementation(() => {
      console.log('from inside tracking');
      return Promise.resolve();
    });
    collector.register();

    console.log('outer');

    expect(logCollector.trackLog).toHaveBeenCalledTimes(1);
  });

  it('restores original console methods on unregister', () => {
    const patchedTargets = [console.log, console.info];
    collector.register();
    expect(console.log).not.toBe(patchedTargets[0]);

    collector.unregister();

    expect(console.log).toBe(patchedTargets[0]);
    expect(console.info).toBe(patchedTargets[1]);
    console.log('after restore');
    expect(logCollector.trackLog).not.toHaveBeenCalled();
  });

  it('register is idempotent', () => {
    collector.register();
    collector.register();

    console.log('once');

    expect(logCollector.trackLog).toHaveBeenCalledTimes(1);
  });
});
