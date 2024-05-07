
import { formatDateToHumanReadable, formatMillisToHumanReadable, formatTimeToHumanReadable, formatTimestampToChartFormat } from '@/app/utils/time_utils';
import { expect, it, describe, beforeEach, afterEach } from '@jest/globals';
import { Settings, DateTime } from "luxon";

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

describe('formatDateToHumanReadable', () => {
    beforeEach(() => {
        Settings.now = () => 0;
        Settings.defaultZone = "Asia/Kolkata"
    });

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf();
    });

    it('should format a UTC timestamp to a human-readable date', () => {
        const timestamp = '2024-04-16T12:00:00Z'; // April 16, 2024, 12:00 PM UTC
        const expected = 'Tue, 16 Apr, 2024';
        expect(formatDateToHumanReadable(timestamp)).toBe(expected);
    });

    it('should format a timestamp with a different date', () => {
        const timestamp = '2024-04-15T03:44:00Z'; // April 15, 2024, 03:44 PM UTC
        const expected = 'Mon, 15 Apr, 2024';
        expect(formatDateToHumanReadable(timestamp)).toBe(expected);
    });

    it('should handle invalid timestamps', () => {
        const timestamp = 'invalid-timestamp';
        expect(() => formatDateToHumanReadable(timestamp)).toThrow();
    });
});

describe('formatTimeToHumanReadable', () => {
    beforeEach(() => {
        Settings.now = () => 0;
        Settings.defaultZone = "Asia/Kolkata"
    });

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf();
    });

    it('should format a UTC timestamp to a human-readable time', () => {
        const timestamp = '2024-04-16T12:00:00Z'; // April 16, 2024, 12:00 PM UTC
        const expected = '5:30:00:000 PM';
        expect(formatTimeToHumanReadable(timestamp)).toBe(expected);
    });

    it('should format a timestamp with a different date and time', () => {
        const timestamp = '2024-04-15T03:44:00Z'; // April 15, 2024, 03:44 PM UTC
        const expected = '9:14:00:000 AM';
        expect(formatTimeToHumanReadable(timestamp)).toBe(expected);
    });

    it('should handle invalid timestamps', () => {
        const timestamp = 'invalid-timestamp';
        expect(() => formatTimeToHumanReadable(timestamp)).toThrow();
    });
});

describe('formatTimestampToChartFormat', () => {
    beforeEach(() => {
        Settings.now = () => 0;
        Settings.defaultZone = "Asia/Kolkata"
    });

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf();
    });

    it('should format a UTC timestamp to chart format', () => {
        const timestamp = '2024-04-16T12:00:00Z'; // April 16, 2024, 12:00 PM UTC
        const expected = '2024-04-16 17:30:00:000 PM';
        expect(formatTimestampToChartFormat(timestamp)).toBe(expected);
    });

    it('should format a timestamp with a different datetime', () => {
        const timestamp = '2024-04-15T03:44:00Z'; // April 15, 2024, 03:44 PM UTC
        const expected = '2024-04-15 09:14:00:000 AM';
        expect(formatTimestampToChartFormat(timestamp)).toBe(expected);
    });

    it('should handle invalid timestamps', () => {
        const timestamp = 'invalid-timestamp';
        expect(() => formatTimestampToChartFormat(timestamp)).toThrow();
    });
});