export const NativeModules = {
  MeasureModule: {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    trackEvent: jest.fn(() => Promise.resolve()),
    trackSpan: jest.fn(() => Promise.resolve()),
    setUserId: jest.fn(() => Promise.resolve()),
    clearUserId: jest.fn(() => Promise.resolve()),
    trackHttpEvent: jest.fn(() => Promise.resolve()),
    launchBugReport: jest.fn(() => Promise.resolve()),
    setShakeListener: jest.fn(() => Promise.resolve()),
    captureScreenshot: jest.fn(() =>
      Promise.resolve({
        name: 'screenshot.png',
        type: 'screenshot',
        path: '/tmp/screenshot.png',
        size: 1024,
        id: 'mock-screenshot-id',
      })
    ),
    trackBugReport: jest.fn(() => Promise.resolve()),
    getSessionId: jest.fn(() => Promise.resolve('mock-session-id')),
    getDynamicConfig: jest.fn(() => Promise.resolve({})),
  },
  MeasureOnShake: {},
};

export const Platform = {
  OS: 'ios' as 'ios' | 'android',
  select: jest.fn((obj: Record<string, unknown>) => obj.ios ?? obj.default),
};

export const NativeEventEmitter = jest.fn().mockImplementation(() => ({
  addListener: jest.fn(),
  removeAllListeners: jest.fn(),
}));
