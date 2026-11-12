describe('measureBridge.start', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('resolves without calling native when start method is absent', async () => {
    const { NativeModules } = require('react-native');
    (NativeModules.MeasureModule as any).start = undefined;

    const { start } = require('../../native/measureBridge');
    await expect(start()).resolves.toBeUndefined();
  });

  it('calls native start and resolves', async () => {
    const { NativeModules } = require('react-native');
    NativeModules.MeasureModule.start = jest.fn(() => Promise.resolve());

    const { start } = require('../../native/measureBridge');
    await expect(start()).resolves.toBeUndefined();
    expect(NativeModules.MeasureModule.start).toHaveBeenCalledTimes(1);
  });

  it('resolves safely when native start returns undefined instead of a Promise', async () => {
    const { NativeModules } = require('react-native');
    NativeModules.MeasureModule.start = jest.fn(() => undefined);

    const { start } = require('../../native/measureBridge');
    await expect(start()).resolves.toBeUndefined();
  });
});

describe('measureBridge.stop', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('resolves without calling native when stop method is absent', async () => {
    const { NativeModules } = require('react-native');
    (NativeModules.MeasureModule as any).stop = undefined;

    const { stop } = require('../../native/measureBridge');
    await expect(stop()).resolves.toBeUndefined();
  });

  it('calls native stop and resolves', async () => {
    const { NativeModules } = require('react-native');
    NativeModules.MeasureModule.stop = jest.fn(() => Promise.resolve());

    const { stop } = require('../../native/measureBridge');
    await expect(stop()).resolves.toBeUndefined();
    expect(NativeModules.MeasureModule.stop).toHaveBeenCalledTimes(1);
  });

  it('resolves safely when native stop returns undefined instead of a Promise', async () => {
    const { NativeModules } = require('react-native');
    NativeModules.MeasureModule.stop = jest.fn(() => undefined);

    const { stop } = require('../../native/measureBridge');
    await expect(stop()).resolves.toBeUndefined();
  });
});

describe('measureBridge.trackHttpEvent', () => {
  const trackHttpEventArgs = (...args: unknown[]) => {
    const { NativeModules } = require('react-native');
    NativeModules.MeasureModule.trackHttpEvent = jest.fn(() =>
      Promise.resolve('ok')
    );
    const { trackHttpEvent } = require('../../native/measureBridge');
    trackHttpEvent(...args);
    return NativeModules.MeasureModule.trackHttpEvent.mock.calls[0];
  };

  beforeEach(() => {
    jest.resetModules();
  });

  it('passes the optional values in an options map', () => {
    const args = trackHttpEventArgs(
      'https://example.com',
      'post',
      1,
      2,
      201,
      null,
      { 'Content-Type': 'application/json' },
      { 'X-Id': '1' },
      '{"a":1}',
      '{"ok":true}',
      'okhttp'
    );
    expect(args).toEqual([
      'https://example.com',
      'post',
      1,
      2,
      'okhttp',
      {
        statusCode: 201,
        error: null,
        requestHeaders: { 'Content-Type': 'application/json' },
        responseHeaders: { 'X-Id': '1' },
        requestBody: '{"a":1}',
        responseBody: '{"ok":true}',
      },
    ]);
  });

  it('passes a missing status code inside the options map', () => {
    const args = trackHttpEventArgs(
      'https://example.com',
      'get',
      1,
      2,
      undefined,
      'timeout'
    );
    expect(args).toHaveLength(6);
    expect(args[5].statusCode).toBeUndefined();
    expect(args[5].error).toBe('timeout');
  });
});
