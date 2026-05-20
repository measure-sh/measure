import { MeasureInternal } from '../measureInternal';
import * as measureBridge from '../native/measureBridge';

jest.mock('../native/measureBridge', () => ({
  enableNativeModule: jest.fn(),
  disableNativeModule: jest.fn(),
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  setShakeListener: jest.fn(),
  getSessionId: jest.fn(() => Promise.resolve('mock-session-id')),
}));

jest.mock('../exception/measureErrorHandlers', () => ({
  setupErrorHandlers: jest.fn(),
}));

function makeMockInitializer() {
  return {
    logger: { internalLog: jest.fn(), log: jest.fn() },
    configLoader: { loadDynamicConfig: jest.fn(() => Promise.resolve(null)) },
    configProvider: { setDynamicConfig: jest.fn() },
    spanProcessor: { onConfigLoaded: jest.fn() },
    customEventCollector: { register: jest.fn(), unregister: jest.fn() },
    userTriggeredEventCollector: { register: jest.fn(), unregister: jest.fn() },
    spanCollector: { register: jest.fn(), unregister: jest.fn() },
    bugReportCollector: { register: jest.fn(), unregister: jest.fn() },
  } as any;
}

describe('MeasureInternal.start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers collectors, enables native module, and calls native start', async () => {
    const initializer = makeMockInitializer();
    const sdk = new MeasureInternal(initializer);

    await sdk.start();

    expect(initializer.customEventCollector.register).toHaveBeenCalledTimes(1);
    expect(initializer.userTriggeredEventCollector.register).toHaveBeenCalledTimes(1);
    expect(initializer.spanCollector.register).toHaveBeenCalledTimes(1);
    expect(initializer.bugReportCollector.register).toHaveBeenCalledTimes(1);
    expect(measureBridge.enableNativeModule).toHaveBeenCalledTimes(1);
    expect(measureBridge.start).toHaveBeenCalledTimes(1);
  });

  it('returns a resolved Promise', async () => {
    const sdk = new MeasureInternal(makeMockInitializer());
    await expect(sdk.start()).resolves.toBeUndefined();
  });

  it('warns and does nothing when already started', async () => {
    const initializer = makeMockInitializer();
    const sdk = new MeasureInternal(initializer);

    await sdk.start();
    jest.clearAllMocks();

    await sdk.start();

    expect(initializer.logger.internalLog).toHaveBeenCalledWith(
      'warning',
      'Measure.start() called but Measure is already started.'
    );
    expect(initializer.customEventCollector.register).not.toHaveBeenCalled();
    expect(measureBridge.enableNativeModule).not.toHaveBeenCalled();
    expect(measureBridge.start).not.toHaveBeenCalled();
  });

  it('resolves immediately without side effects when already started', async () => {
    const sdk = new MeasureInternal(makeMockInitializer());
    await sdk.start();
    await expect(sdk.start()).resolves.toBeUndefined();
  });
});

describe('MeasureInternal.stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unregisters collectors, disables native module, and calls native stop', async () => {
    const initializer = makeMockInitializer();
    const sdk = new MeasureInternal(initializer);

    await sdk.start();
    jest.clearAllMocks();

    await sdk.stop();

    expect(initializer.customEventCollector.unregister).toHaveBeenCalledTimes(1);
    expect(initializer.userTriggeredEventCollector.unregister).toHaveBeenCalledTimes(1);
    expect(initializer.spanCollector.unregister).toHaveBeenCalledTimes(1);
    expect(initializer.bugReportCollector.unregister).toHaveBeenCalledTimes(1);
    expect(measureBridge.disableNativeModule).toHaveBeenCalledTimes(1);
    expect(measureBridge.stop).toHaveBeenCalledTimes(1);
  });

  it('returns a resolved Promise', async () => {
    const sdk = new MeasureInternal(makeMockInitializer());
    await sdk.start();
    await expect(sdk.stop()).resolves.toBeUndefined();
  });

  it('warns and does nothing when not started', async () => {
    const initializer = makeMockInitializer();
    const sdk = new MeasureInternal(initializer);

    await sdk.stop();

    expect(initializer.logger.internalLog).toHaveBeenCalledWith(
      'warning',
      'Measure.stop() called but Measure is not started.'
    );
    expect(initializer.customEventCollector.unregister).not.toHaveBeenCalled();
    expect(measureBridge.disableNativeModule).not.toHaveBeenCalled();
    expect(measureBridge.stop).not.toHaveBeenCalled();
  });

  it('resolves immediately without side effects when not started', async () => {
    const sdk = new MeasureInternal(makeMockInitializer());
    await expect(sdk.stop()).resolves.toBeUndefined();
  });
});

describe('MeasureInternal start/stop lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('can be stopped after starting', async () => {
    const sdk = new MeasureInternal(makeMockInitializer());
    await sdk.start();
    await expect(sdk.stop()).resolves.toBeUndefined();
    expect(measureBridge.stop).toHaveBeenCalledTimes(1);
  });

  it('can be restarted after stopping', async () => {
    const sdk = new MeasureInternal(makeMockInitializer());

    await sdk.start();
    await sdk.stop();
    jest.clearAllMocks();

    await sdk.start();

    expect(measureBridge.start).toHaveBeenCalledTimes(1);
    expect(measureBridge.enableNativeModule).toHaveBeenCalledTimes(1);
  });

  it('start → stop → start does not double-register collectors', async () => {
    const initializer = makeMockInitializer();
    const sdk = new MeasureInternal(initializer);

    await sdk.start();
    await sdk.stop();
    await sdk.start();

    expect(initializer.customEventCollector.register).toHaveBeenCalledTimes(2);
    expect(initializer.customEventCollector.unregister).toHaveBeenCalledTimes(1);
  });
});

describe('MeasureInternal.init with autoStart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers collectors and calls native start when autoStart is true', async () => {
    const initializer = makeMockInitializer();
    const sdk = new MeasureInternal(initializer);

    await sdk.init({ config: { autoStart: true } as any });

    expect(initializer.customEventCollector.register).toHaveBeenCalledTimes(1);
    expect(measureBridge.enableNativeModule).toHaveBeenCalledTimes(1);
    expect(measureBridge.start).toHaveBeenCalledTimes(1);
  });

  it('does not register collectors or call native start when autoStart is false', async () => {
    const initializer = makeMockInitializer();
    const sdk = new MeasureInternal(initializer);

    await sdk.init({ config: { autoStart: false } as any });

    expect(initializer.customEventCollector.register).not.toHaveBeenCalled();
    expect(measureBridge.enableNativeModule).not.toHaveBeenCalled();
    expect(measureBridge.start).not.toHaveBeenCalled();
  });
});
