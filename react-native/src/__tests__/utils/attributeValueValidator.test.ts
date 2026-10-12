import {
  dropInvalidAttributes,
  validateAttributes,
} from '../../utils/attributeValueValidator';
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

  it('should return false for a key with invalid characters', () => {
    expect(validateAttributes({ 'plan.type': 'pro' }, logger)).toBe(false);
    expect(validateAttributes({ 'bad key': 'value' }, logger)).toBe(false);
    expect(logger.log).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining("Invalid attribute key 'plan.type'")
    );
  });

  it('should return false for an empty key', () => {
    expect(validateAttributes({ '': 'value' }, logger)).toBe(false);
  });

  it('should return false for a key longer than 256 characters', () => {
    expect(validateAttributes({ ['k'.repeat(256)]: 'value' }, logger)).toBe(
      true
    );
    expect(validateAttributes({ ['k'.repeat(257)]: 'value' }, logger)).toBe(
      false
    );
  });

  it('should return false for a string value longer than 256 characters', () => {
    expect(validateAttributes({ plan: 'v'.repeat(256) }, logger)).toBe(true);
    expect(validateAttributes({ plan: 'v'.repeat(257) }, logger)).toBe(false);
  });

  it('should return false for more than 100 attributes', () => {
    expect(validateAttributes(manyAttributes(100), logger)).toBe(true);
    expect(validateAttributes(manyAttributes(101), logger)).toBe(false);
    expect(logger.log).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('exceed the maximum of 100')
    );
  });
});

describe('dropInvalidAttributes', () => {
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    logger = {
      enabled: true,
      log: jest.fn(),
      internalLog: jest.fn(),
    };
  });

  it('should keep all attributes when they are valid', () => {
    const input = { name: 'event', count: 42, enabled: false };

    expect(dropInvalidAttributes('span', input, logger)).toEqual(input);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('should drop attributes with invalid keys or values', () => {
    const input = {
      'valid': 'ok',
      'bad key': 'value',
      'long_value': 'v'.repeat(257),
      'nested': { a: 1 },
    };

    expect(dropInvalidAttributes('span', input, logger)).toEqual({
      valid: 'ok',
    });
    expect(logger.log).toHaveBeenCalledWith(
      'warning',
      'Invalid attributes for span: dropped 3 attributes'
    );
  });

  it('should keep at most 100 attributes', () => {
    const result = dropInvalidAttributes(
      'bug_report',
      manyAttributes(101),
      logger
    );

    expect(Object.keys(result)).toHaveLength(100);
    expect(logger.log).toHaveBeenCalledWith(
      'warning',
      'Invalid attributes for bug_report: dropped 1 attributes'
    );
  });
});

function manyAttributes(count: number): Record<string, number> {
  const attributes: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    attributes[`attr_${i}`] = i;
  }
  return attributes;
}
