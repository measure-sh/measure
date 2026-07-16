import { validateAttributes } from '../../utils/attributeValueValidator';
import type { Logger } from '../../utils/logger';

describe('validateAttributes', () => {
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    logger = {
      enabled: true,
      log: jest.fn(),
      internalLog: jest.fn(),
    };
  });

  it('should return true when all attributes are valid', () => {
    const input = {
      name: 'event',
      count: 42,
      enabled: false,
    };

    const result = validateAttributes(input, logger);
    expect(result).toBe(true);
  });

  it('should return false when any attribute is invalid', () => {
    const input = {
      name: 'event',
      invalid: { nested: true },
    };

    const result = validateAttributes(input, logger);
    expect(result).toBe(false);
  });

  it('should log a warning for invalid attributes', () => {
    const input = {
      valid: 'ok',
      bad: null,
    };

    const result = validateAttributes(input, logger);

    expect(result).toBe(false);
    expect(logger.log).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining("Invalid attribute 'bad'")
    );
  });

  it('should return true for an empty object', () => {
    const result = validateAttributes({}, logger);
    expect(result).toBe(true);
  });

  it('should handle undefined attributes gracefully', () => {
    const result = validateAttributes({ key: undefined }, logger);
    expect(result).toBe(false);
  });

  it('should return false for attributes with unsupported types (function, symbol)', () => {
    const input = {
      fn: () => {},
      sym: Symbol('test'),
    };

    const result = validateAttributes(input, logger);
    expect(result).toBe(false);
  });

  it('should stop validation at the first invalid attribute', () => {
    const input = {
      valid1: 'ok',
      bad: [],
      valid2: 'should not be checked',
    };

    const result = validateAttributes(input, logger);
    expect(result).toBe(false);
    expect(logger.log).toHaveBeenCalledTimes(1);
  });
});
