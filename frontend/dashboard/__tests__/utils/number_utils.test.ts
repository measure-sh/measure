import { kilobytesToMegabytes } from '@/app/utils/number_utils';
import { expect, it, describe } from '@jest/globals';

describe('kilobytesToMegabytes', () => {
  it('should convert kilobytes to megabytes', () => {
    expect(kilobytesToMegabytes(10485760)).toBe(10240)
    expect(kilobytesToMegabytes(1024)).toBe(1)
  })
})
