import { formatBytesSI, kilobytesToMegabytes, numberToKMB, toKiloBytes, toMegaBytes } from '@/app/utils/number_utils'
import { describe, expect, it } from '@jest/globals'

describe('number_utils', () => {
  describe('kilobytesToMegabytes', () => {
    it('should convert kilobytes to megabytes', () => {
      expect(kilobytesToMegabytes(10485760)).toBe(10240)
      expect(kilobytesToMegabytes(1024)).toBe(1)
    })

    it('should return 0 when input is 0', () => {
      expect(kilobytesToMegabytes(0)).toBe(0)
    })

    it('should return -1 when input is negative', () => {
      expect(kilobytesToMegabytes(-1024)).toBe(-1)
    })
  })

  describe('toKiloBytes', () => {
    it('should convert bytes to kilobytes', () => {
      expect(toKiloBytes(1024)).toBe(1)
      expect(toKiloBytes(2048)).toBe(2)
    })

    it('should return 0 when input is 0', () => {
      expect(toKiloBytes(0)).toBe(0)
    })
  })

  describe('toMegaBytes', () => {
    it('should convert bytes to megabytes', () => {
      expect(toMegaBytes(1024 * 1024)).toBe(1)
      expect(toMegaBytes(2 * 1024 * 1024)).toBe(2)
    })

    it('should return 0 when input is 0', () => {
      expect(toMegaBytes(0)).toBe(0)
    })
  })

  describe('formatBytesSI', () => {
    it('should format bytes', () => {
      expect(formatBytesSI(0)).toBe('0 B')
      expect(formatBytesSI(512)).toBe('512 B')
      expect(formatBytesSI(999)).toBe('999 B')
    })

    it('should format kilobytes (decimal: 1 KB = 1000 B)', () => {
      expect(formatBytesSI(1000)).toBe('1.0 KB')
      expect(formatBytesSI(1500)).toBe('1.5 KB')
      expect(formatBytesSI(50_000)).toBe('50.0 KB')
    })

    it('should format megabytes (decimal: 1 MB = 1_000_000 B)', () => {
      expect(formatBytesSI(1_000_000)).toBe('1.0 MB')
      expect(formatBytesSI(1_500_000)).toBe('1.5 MB')
      expect(formatBytesSI(500_000_000)).toBe('500.0 MB')
    })

    it('should format gigabytes (decimal: 1 GB = 1_000_000_000 B)', () => {
      expect(formatBytesSI(1_000_000_000)).toBe('1.00 GB')
      expect(formatBytesSI(5_000_000_000)).toBe('5.00 GB')
      expect(formatBytesSI(2_500_000_000)).toBe('2.50 GB')
    })

    it('should format terabytes (decimal: 1 TB = 1e12 B)', () => {
      expect(formatBytesSI(1e12)).toBe('1.00 TB')
      expect(formatBytesSI(3.75e12)).toBe('3.75 TB')
    })

    it('should format petabytes (decimal: 1 PB = 1e15 B)', () => {
      expect(formatBytesSI(1e15)).toBe('1.00 PB')
      expect(formatBytesSI(2e15)).toBe('2.00 PB')
    })

    it('should handle negative values', () => {
      expect(formatBytesSI(-1000)).toBe('-1.0 KB')
      expect(formatBytesSI(-1_000_000)).toBe('-1.0 MB')
      expect(formatBytesSI(-1_000_000_000)).toBe('-1.00 GB')
      expect(formatBytesSI(-1e12)).toBe('-1.00 TB')
      expect(formatBytesSI(-1e15)).toBe('-1.00 PB')
    })
  })

  describe('numberToKMB', () => {
    it('should return value as string for numbers less than 1000', () => {
      expect(numberToKMB(0)).toBe('0')
      expect(numberToKMB(999)).toBe('999')
      expect(numberToKMB(-1)).toBe('-1')
    })

    it('should convert thousands to K', () => {
      expect(numberToKMB(1000)).toBe('1K')
      expect(numberToKMB(1500)).toBe('1.5K')
      expect(numberToKMB(1999)).toBe('1.999K')
      expect(numberToKMB(2000)).toBe('2K')
      expect(numberToKMB(12345)).toBe('12.345K')
    })

    it('should convert millions to M', () => {
      expect(numberToKMB(1_000_000)).toBe('1M')
      expect(numberToKMB(1_500_000)).toBe('1.5M')
      expect(numberToKMB(2_000_000)).toBe('2M')
      expect(numberToKMB(12_345_678)).toBe('12.345678M')
    })

    it('should convert billions to B', () => {
      expect(numberToKMB(1_000_000_000)).toBe('1B')
      expect(numberToKMB(1_500_000_000)).toBe('1.5B')
      expect(numberToKMB(2_000_000_000)).toBe('2B')
      expect(numberToKMB(12_345_678_901)).toBe('12.345678901B')
    })

    it('should handle negative numbers', () => {
      expect(numberToKMB(-1000)).toBe('-1K')
      expect(numberToKMB(-1_000_000)).toBe('-1M')
      expect(numberToKMB(-1_000_000_000)).toBe('-1B')
    })

    it('should remove trailing .0 for integer results', () => {
      expect(numberToKMB(2000)).toBe('2K')
      expect(numberToKMB(2_000_000)).toBe('2M')
      expect(numberToKMB(2_000_000_000)).toBe('2B')
    })
  })
})