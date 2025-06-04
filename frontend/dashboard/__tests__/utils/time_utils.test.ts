import { formatChartFormatTimestampToHumanReadable, formatDateToHumanReadableDate, formatDateToHumanReadableDateTime, formatDateToHumanReadableTime, formatIsoDateForDateTimeInputField, formatMillisToHumanReadable, formatTimestampToChartFormat, formatUserInputDateToServerFormat, isValidTimestamp } from '@/app/utils/time_utils'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import { DateTime, Settings } from "luxon"

describe('formatMillisToHumanReadable', () => {
    it('should return milliseconds for values less than a second', () => {
        expect(formatMillisToHumanReadable(500)).toBe('500ms')
    })

    it('should return seconds for values between 1 second and 1 minute', () => {
        expect(formatMillisToHumanReadable(5000)).toBe('5s')
        expect(formatMillisToHumanReadable(59999)).toBe('59s, 999ms')
    })

    it('should return minutes for values between 1 minute and 1 hour', () => {
        expect(formatMillisToHumanReadable(60000)).toBe('1min')
        expect(formatMillisToHumanReadable(120000)).toBe('2min')
        expect(formatMillisToHumanReadable(3599999)).toBe('59min, 59s, 999ms')
    })

    it('should return hours for values between 1 hour and 1 day', () => {
        expect(formatMillisToHumanReadable(3600000)).toBe('1h')
        expect(formatMillisToHumanReadable(7200000)).toBe('2h')
        expect(formatMillisToHumanReadable(86399999)).toBe('23h, 59min, 59s, 999ms')
    })

    it('should return days for values greater than 1 day', () => {
        expect(formatMillisToHumanReadable(86400000)).toBe('1d')
        expect(formatMillisToHumanReadable(172800000)).toBe('2d')
        expect(formatMillisToHumanReadable(259200000)).toBe('3d')
        expect(formatMillisToHumanReadable(604799999)).toBe('6d, 23h, 59min, 59s, 999ms')
    })

    it('should round decimal milliseconds to nearest int', () => {
        expect(formatMillisToHumanReadable(500.920473)).toBe('501ms')
    })

    it('should handle zero input', () => {
        expect(formatMillisToHumanReadable(0)).toBe('0ms')
    })

    it('should handle negative input', () => {
        expect(formatMillisToHumanReadable(-1000)).toBe('0ms')
    })
})

describe('formatDateToHumanReadableDateTime', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should format a UTC timestamp to a human readable date', () => {
        const timestamp = '2024-04-16T12:00:00Z'
        const expected = '16 Apr, 2024, 5:30:00 PM'
        expect(formatDateToHumanReadableDateTime(timestamp)).toBe(expected)
    })

    it('should format a UTC timestamp to a human readable date', () => {
        const timestamp = '2024-04-15T03:44:00Z'
        const expected = '15 Apr, 2024, 9:14:00 AM'
        expect(formatDateToHumanReadableDateTime(timestamp)).toBe(expected)
    })

    it('should throw on invalid timestamps', () => {
        const timestamp = 'invalid-timestamp'
        expect(() => formatDateToHumanReadableDateTime(timestamp)).toThrow()
    })
})

describe('formatDateToHumanReadableDate', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should format a UTC timestamp to a human readable date', () => {
        const timestamp = '2024-04-16T12:00:00Z'
        const expected = '16 Apr, 2024'
        expect(formatDateToHumanReadableDate(timestamp)).toBe(expected)
    })

    it('should format a UTC timestamp to a human readable date', () => {
        const timestamp = '2024-04-15T03:44:00Z'
        const expected = '15 Apr, 2024'
        expect(formatDateToHumanReadableDate(timestamp)).toBe(expected)
    })

    it('should throw on invalid timestamps', () => {
        const timestamp = 'invalid-timestamp'
        expect(() => formatDateToHumanReadableDate(timestamp)).toThrow()
    })
})

describe('formatDateToHumanReadableTime', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should format a UTC timestamp to a human readable date', () => {
        const timestamp = '2024-04-16T12:00:00Z'
        const expected = '5:30:00 PM'
        expect(formatDateToHumanReadableTime(timestamp)).toBe(expected)
    })

    it('should format a UTC timestamp to a human readable date', () => {
        const timestamp = '2024-04-15T03:44:00Z'
        const expected = '9:14:00 AM'
        expect(formatDateToHumanReadableTime(timestamp)).toBe(expected)
    })

    it('should throw on invalid timestamps', () => {
        const timestamp = 'invalid-timestamp'
        expect(() => formatDateToHumanReadableTime(timestamp)).toThrow()
    })
})

describe('formatTimestampToChartFormat', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should format a UTC timestamp to chart format', () => {
        const timestamp = '2024-04-16T12:00:00Z'
        const expected = '2024-04-16 17:30:00:000 PM'
        expect(formatTimestampToChartFormat(timestamp)).toBe(expected)
    })

    it('should format a UTC timestamp to chart format', () => {
        const timestamp = '2024-04-15T03:44:00Z'
        const expected = '2024-04-15 09:14:00:000 AM'
        expect(formatTimestampToChartFormat(timestamp)).toBe(expected)
    })

    it('should throw on invalid timestamps', () => {
        const timestamp = 'invalid-timestamp'
        expect(() => formatTimestampToChartFormat(timestamp)).toThrow()
    })
})

describe('formatChartFormatTimestampToHumanReadable', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should format a chart format timestamp to human readable', () => {
        const timestamp = '2024-05-24 01:45:29:957 PM'
        const expected = 'Fri, 24 May, 2024, 1:45:29:957 PM'
        expect(formatChartFormatTimestampToHumanReadable(timestamp)).toBe(expected)
    })

    it('should format a chart format timestamp to human readable', () => {
        const timestamp = '2024-06-27 10:11:52:003 AM'
        const expected = 'Thu, 27 Jun, 2024, 10:11:52:003 AM'
        expect(formatChartFormatTimestampToHumanReadable(timestamp)).toBe(expected)
    })

    it('should throw on invalid timestamps', () => {
        const timestamp = 'invalid-timestamp'
        expect(() => formatChartFormatTimestampToHumanReadable(timestamp)).toThrow()
    })
})

describe('formatUserSelectedDateToServerFormat', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should format a user input date to server format', () => {
        const timestamp = '2024-07-18T09:32:47+05:30'
        const expected = '2024-07-18T04:02:47.000Z'
        expect(formatUserInputDateToServerFormat(timestamp)).toBe(expected)
    })

    it('should format a user input date to server format', () => {
        const timestamp = '2025-03-11T16:54:23+01:00'
        const expected = '2025-03-11T15:54:23.000Z'
        expect(formatUserInputDateToServerFormat(timestamp)).toBe(expected)
    })

    it('should throw on invalid timestamps', () => {
        const timestamp = 'invalid-timestamp'
        expect(() => formatTimestampToChartFormat(timestamp)).toThrow()
    })
})

describe('formatIsoDateForDateTimeInputField', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should format a ISO date to date time input filed format', () => {
        const timestamp = '2024-07-18T09:32:47+05:30'
        const expected = '2024-07-18T09:32'
        expect(formatIsoDateForDateTimeInputField(timestamp)).toBe(expected)
    })

    it('should format a ISO date to date time input filed format', () => {
        const timestamp = '2025-03-11T15:54:23.000Z'
        const expected = '2025-03-11T21:24'
        expect(formatIsoDateForDateTimeInputField(timestamp)).toBe(expected)
    })

    it('should throw on invalid timestamps', () => {
        const timestamp = 'invalid-timestamp'
        expect(() => formatTimestampToChartFormat(timestamp)).toThrow()
    })
})

describe('isValidTimestamp', () => {
    beforeEach(() => {
        Settings.now = () => 0
        Settings.defaultZone = "Asia/Kolkata"
    })

    afterEach(() => {
        Settings.now = () => DateTime.now().valueOf()
    })

    it('should return true on valid timestamp', () => {
        const timestamp = '2024-04-16T12:00:00Z' // April 16, 2024, 12:00 PM UTC
        expect(isValidTimestamp(timestamp)).toBe(true)
    })

    it('should return false on invalid timestamp', () => {
        const timestamp = 'invalid-timestamp'
        expect(isValidTimestamp(timestamp)).toBe(false)
    })
})