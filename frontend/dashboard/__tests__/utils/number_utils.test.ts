import { kilobytesToMegabytes, numberToKMB } from '@/app/utils/number_utils'
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

  describe('numberToKMB', () => {
    it('should return value as string for numbers less than 1000', () => {
      expect(numberToKMB(0)).toBe('0')
      expect(numberToKMB(999)).toBe('999')
      expect(numberToKMB(-1)).toBe('-1')
    })

    it('should convert thousands to K', () => {
      expect(numberToKMB(1000)).toBe('1K')
      expect(numberToKMB(1500)).toBe('1.5K')
      expect(numberToKMB(1999)).toBe('2K')
      expect(numberToKMB(2000)).toBe('2K')
      expect(numberToKMB(12345)).toBe('12.35K')
    })

    it('should convert millions to M', () => {
      expect(numberToKMB(1_000_000)).toBe('1M')
      expect(numberToKMB(1_500_000)).toBe('1.5M')
      expect(numberToKMB(2_000_000)).toBe('2M')
      expect(numberToKMB(12_345_678)).toBe('12.35M')
    })

    it('should convert billions to B', () => {
      expect(numberToKMB(1_000_000_000)).toBe('1B')
      expect(numberToKMB(1_500_000_000)).toBe('1.5B')
      expect(numberToKMB(2_000_000_000)).toBe('2B')
      expect(numberToKMB(12_345_678_901)).toBe('12.35B')
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