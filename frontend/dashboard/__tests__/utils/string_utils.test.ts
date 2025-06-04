
import { formatToCamelCase } from '@/app/utils/string_utils';
import { describe, expect, it } from '@jest/globals';

describe('formatToCamelCase', () => {
    it('should convert the first character of a string to uppercase', () => {
        expect(formatToCamelCase('hello')).toBe('Hello');
        expect(formatToCamelCase('world')).toBe('World');
    });

    it('should not modify the rest of the string', () => {
        expect(formatToCamelCase('fooBar')).toBe('FooBar');
        expect(formatToCamelCase('camelCase')).toBe('CamelCase');
    });

    it('should handle empty strings', () => {
        expect(formatToCamelCase('')).toBe('');
    });

    it('should handle strings with non-alphabetic characters', () => {
        expect(formatToCamelCase('123abc')).toBe('123abc');
        expect(formatToCamelCase('@#$%^&')).toBe('@#$%^&');
    });
});