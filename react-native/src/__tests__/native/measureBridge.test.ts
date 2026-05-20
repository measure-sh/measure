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
