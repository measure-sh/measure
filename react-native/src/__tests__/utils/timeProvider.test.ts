import { MeasureTimeProvider } from '../../utils/timeProvider';

describe('MeasureTimeProvider.now', () => {
  let performanceNow: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    performanceNow = jest.spyOn(performance, 'now').mockReturnValue(50.25);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the anchored epoch time at initialization', () => {
    const provider = new MeasureTimeProvider();
    expect(provider.now()).toBe(1_000_000);
  });

  it('rounds the elapsed time down to whole milliseconds', () => {
    const provider = new MeasureTimeProvider();
    performanceNow.mockReturnValue(50.25 + 123.98);
    expect(provider.now()).toBe(1_000_123);
  });

  it('is not affected by the wall clock changing after initialization', () => {
    const provider = new MeasureTimeProvider();
    jest.spyOn(Date, 'now').mockReturnValue(5_000_000);
    performanceNow.mockReturnValue(50.25 + 10);
    expect(provider.now()).toBe(1_000_010);
  });
});
