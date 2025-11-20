import { validateAttributes } from '../../utils/attributeValueValidator';

describe('validateAttributes', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {}); // silence dev warnings
    // @ts-ignore
    global.__DEV__ = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return true when all attributes are valid', () => {
    const input = {
      name: 'event',
      count: 42,
      enabled: false,
    };

    const result = validateAttributes(input);
    expect(result).toBe(true);
  });

  it('should return false when any attribute is invalid', () => {
    const input = {
      name: 'event',
      invalid: { nested: true },
    };

    const result = validateAttributes(input);
    expect(result).toBe(false);
  });

  it('should log a warning in dev mode for invalid attributes', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const input = {
      valid: 'ok',
      bad: null,
    };

    const result = validateAttributes(input);

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MeasureRN] Invalid attribute'),
      null
    );
  });

  it('should return true for an empty object', () => {
    const result = validateAttributes({});
    expect(result).toBe(true);
  });

  it('should handle undefined attributes gracefully', () => {
    const result = validateAttributes({ key: undefined });
    expect(result).toBe(false);
  });

  it('should return false for attributes with unsupported types (function, symbol)', () => {
    const input = {
      fn: () => {},
      sym: Symbol('test'),
    };

    const result = validateAttributes(input);
    expect(result).toBe(false);
  });

  it('should stop validation at the first invalid attribute', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const input = {
      valid1: 'ok',
      bad: [],
      valid2: 'should not be checked',
    };

    const result = validateAttributes(input);
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});