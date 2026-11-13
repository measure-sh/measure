import { parseStacktrace } from '../../exception/stacktraceParser';

describe('parseStacktrace', () => {
  it('parses a Chrome/V8 style stack trace', () => {
    const err = new Error('Something went wrong!');
    err.stack = `Error: Something went wrong!
    at myFunc (/path/to/file.js:10:15)
    at /path/to/other.js:20:5`;

    const parsed = parseStacktrace(err);

    expect(parsed.type).toBe('Error');
    expect(parsed.message).toBe('Something went wrong!');
    expect(parsed.stacktrace).toEqual([
      {
        function: 'myFunc',
        file: '/path/to/file.js',
        line: 10,
        column: 15,
      },
      {
        function: '<anonymous>',
        file: '/path/to/other.js',
        line: 20,
        column: 5,
      },
    ]);
  });

  it('handles null/undefined errors gracefully', () => {
    expect(parseStacktrace(undefined)).toEqual({
      type: 'UnknownError',
      message: 'undefined',
      stacktrace: [],
    });
  });

  it('parses non-Error thrown values', () => {
    const parsed = parseStacktrace('oops');
    expect(parsed.type).toBe('string');
    expect(parsed.message).toBe('oops');
    expect(parsed.stacktrace).toEqual([]);
  });

  it('uses the message of a plain object', () => {
    const parsed = parseStacktrace({ code: 7, message: 'request failed' });
    expect(parsed.type).toBe('object');
    expect(parsed.message).toBe('request failed');
    expect(parsed.stacktrace).toEqual([]);
  });

  it('serializes a plain object without a message', () => {
    const parsed = parseStacktrace({ code: 7, reason: 'timeout' });
    expect(parsed.type).toBe('object');
    expect(parsed.message).toBe('{"code":7,"reason":"timeout"}');
  });

  it('serializes a plain object with a non-string message', () => {
    const parsed = parseStacktrace({ message: 42 });
    expect(parsed.message).toBe('{"message":42}');
  });

  it('parses the name, message and stack of an error-like object', () => {
    const parsed = parseStacktrace({
      name: 'ApiError',
      message: 'not found',
      stack: 'ApiError: not found\n    at load (/path/to/api.js:3:9)',
    });
    expect(parsed.type).toBe('ApiError');
    expect(parsed.message).toBe('not found');
    expect(parsed.stacktrace).toEqual([
      { function: 'load', file: '/path/to/api.js', line: 3, column: 9 },
    ]);
  });

  it('falls back to String() for an object that cannot be serialized', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(parseStacktrace(circular).message).toBe('[object Object]');
  });

  it('serializes an array', () => {
    const parsed = parseStacktrace([1, 'two']);
    expect(parsed.type).toBe('object');
    expect(parsed.message).toBe('[1,"two"]');
  });
});
