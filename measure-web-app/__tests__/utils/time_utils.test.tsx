
import { formatMillisToHumanReadable } from '@/app/utils/time_utils';
import { expect, it, describe } from '@jest/globals';

describe('formatMillisToHumanReadable', () => {
    it('should return milliseconds for values less than a second', () => {
        expect(formatMillisToHumanReadable(500)).toBe('500ms')
    });

    it('should return seconds for values between 1 second and 1 minute', () => {
        expect(formatMillisToHumanReadable(5000)).toBe('5s');
        expect(formatMillisToHumanReadable(59999)).toBe('59s, 999ms')
    });

    it('should return minutes for values between 1 minute and 1 hour', () => {
        expect(formatMillisToHumanReadable(60000)).toBe('1min')
        expect(formatMillisToHumanReadable(120000)).toBe('2min')
        expect(formatMillisToHumanReadable(3599999)).toBe('59min, 59s, 999ms')
    });

    it('should return hours for values between 1 hour and 1 day', () => {
        expect(formatMillisToHumanReadable(3600000)).toBe('1h')
        expect(formatMillisToHumanReadable(7200000)).toBe('2h')
        expect(formatMillisToHumanReadable(86399999)).toBe('23h, 59min, 59s, 999ms')
    });

    it('should return days for values greater than 1 day', () => {
        expect(formatMillisToHumanReadable(86400000)).toBe('1d')
        expect(formatMillisToHumanReadable(172800000)).toBe('2d')
        expect(formatMillisToHumanReadable(259200000)).toBe('3d')
        expect(formatMillisToHumanReadable(604799999)).toBe('6d, 23h, 59min, 59s, 999ms')
    });

    it('should handle zero input', () => {
        expect(formatMillisToHumanReadable(0)).toBe('')
    });

    it('should handle negative input', () => {
        expect(formatMillisToHumanReadable(-1000)).toBe('')
    });
});