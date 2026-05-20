import { MeasureConfig } from '../config/measureConfig';

function setupMocks(
  mockInit: jest.Mock,
  mockStart: jest.Mock,
  mockStop: jest.Mock
) {
  jest.mock('../measureInitializer', () => ({
    MeasureInitializer: jest.fn(),
  }));
  jest.mock('../measureInternal', () => ({
    MeasureInternal: jest.fn().mockImplementation(() => ({
      init: mockInit,
      start: mockStart,
      stop: mockStop,
    })),
  }));
}

describe('Measure.init', () => {
  let Measure: any;
  let mockInit: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    mockInit = jest.fn(() => Promise.resolve());
    setupMocks(mockInit, jest.fn(), jest.fn());
    Measure = require('../measure').Measure;
  });

  it('should only initialize once', async () => {
    const config = new MeasureConfig({ enableLogging: true, autoStart: true });

    const firstPromise = Measure.init(config);
    expect(mockInit).toHaveBeenCalledTimes(1);

    const secondPromise = Measure.init(config);
    expect(mockInit).toHaveBeenCalledTimes(1);

    expect(secondPromise).toBe(firstPromise);

    await firstPromise;
  });
});

describe('Measure.start', () => {
  let Measure: any;
  let mockStart: jest.Mock;

  beforeEach(async () => {
    jest.resetModules();
    mockStart = jest.fn(() => Promise.resolve());
    setupMocks(jest.fn(() => Promise.resolve()), mockStart, jest.fn());
    Measure = require('../measure').Measure;
  });

  it('returns a resolved Promise when not initialized', async () => {
    await expect(Measure.start()).resolves.toBeUndefined();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('delegates to measureInternal.start() and returns its Promise', async () => {
    const config = new MeasureConfig({ autoStart: false });
    await Measure.init(config);

    await expect(Measure.start()).resolves.toBeUndefined();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});

describe('Measure.stop', () => {
  let Measure: any;
  let mockStop: jest.Mock;

  beforeEach(async () => {
    jest.resetModules();
    mockStop = jest.fn(() => Promise.resolve());
    setupMocks(jest.fn(() => Promise.resolve()), jest.fn(), mockStop);
    Measure = require('../measure').Measure;
  });

  it('returns a resolved Promise when not initialized', async () => {
    await expect(Measure.stop()).resolves.toBeUndefined();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('delegates to measureInternal.stop() and returns its Promise', async () => {
    const config = new MeasureConfig({ autoStart: true });
    await Measure.init(config);

    await expect(Measure.stop()).resolves.toBeUndefined();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
