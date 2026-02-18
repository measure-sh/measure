import type { IConfigProvider } from '../../config/configProvider';
import { TraceSampler } from '../../tracing/traceSampler';

describe('TraceSampler', () => {
  let config: IConfigProvider;
  let sampler: TraceSampler;

  beforeEach(() => {
    config = {
      enableFullCollectionMode: false,
      traceSamplingRate: 0,
    } as IConfigProvider;

    sampler = new TraceSampler(config);
  });

  describe('full collection mode', () => {
    it('always samples when enableFullCollectionMode is true', () => {
      config.enableFullCollectionMode = true;
      config.traceSamplingRate = 0;

      expect(
        sampler.shouldSampleTrace('00000000000000000000000000000001')
      ).toBe(true);
      expect(
        sampler.shouldSampleTrace('ffffffffffffffffffffffffffffffff')
      ).toBe(true);
      expect(sampler.shouldSampleTrace('')).toBe(true);
      expect(sampler.shouldSampleTrace('not-a-trace-id')).toBe(true);
    });
  });

  describe('sampling rate boundaries', () => {
    it('never samples when rate is 0', () => {
      config.traceSamplingRate = 0;

      expect(
        sampler.shouldSampleTrace('00000000000000000000000000000001')
      ).toBe(false);
      expect(
        sampler.shouldSampleTrace('ffffffffffffffffffffffffffffffff')
      ).toBe(false);
      expect(sampler.shouldSampleTrace('')).toBe(false);
    });

    it('always samples when rate is 100', () => {
      config.traceSamplingRate = 100;

      expect(
        sampler.shouldSampleTrace('00000000000000000000000000000001')
      ).toBe(true);
      expect(
        sampler.shouldSampleTrace('ffffffffffffffffffffffffffffffff')
      ).toBe(true);
      expect(sampler.shouldSampleTrace('random')).toBe(true);
    });
  });

  describe('deterministic behavior', () => {
    it('returns the same result for the same traceId', () => {
      config.traceSamplingRate = 50;

      const traceId = '0123456789abcdef0123456789abcdef';

      const first = sampler.shouldSampleTrace(traceId);
      const second = sampler.shouldSampleTrace(traceId);
      const third = sampler.shouldSampleTrace(traceId);

      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe('lower 64-bit usage', () => {
    it('ignores the upper 64 bits of the traceId', () => {
      config.traceSamplingRate = 50;

      const lower = '0123456789abcdef';

      const traceId1 = 'aaaaaaaaaaaaaaaa' + lower;
      const traceId2 = 'ffffffffffffffff' + lower;

      const result1 = sampler.shouldSampleTrace(traceId1);
      const result2 = sampler.shouldSampleTrace(traceId2);

      expect(result1).toBe(result2);
    });

    it('changes result when lower 64 bits change', () => {
      config.traceSamplingRate = 50;

      const traceId1 = 'aaaaaaaaaaaaaaaa0000000000000001';
      const traceId2 = 'aaaaaaaaaaaaaaaa7fffffffffffffff';

      const result1 = sampler.shouldSampleTrace(traceId1);
      const result2 = sampler.shouldSampleTrace(traceId2);

      expect(result1).not.toBe(result2);
    });
  });

  describe('sampling threshold behavior', () => {
    it('samples very small ids at moderate rates', () => {
      config.traceSamplingRate = 50;

      const traceId = '00000000000000000000000000000001';
      expect(sampler.shouldSampleTrace(traceId)).toBe(true);
    });

    it('does not sample very large ids at low rates', () => {
      config.traceSamplingRate = 1;

      const traceId = 'ffffffffffffffffffffffffffffffff';
      expect(sampler.shouldSampleTrace(traceId)).toBe(false);
    });
  });

  describe('invalid traceId handling', () => {
    it('does not throw on empty traceId', () => {
      config.traceSamplingRate = 50;

      expect(() => sampler.shouldSampleTrace('')).not.toThrow();

      const first = sampler.shouldSampleTrace('');
      const second = sampler.shouldSampleTrace('');
      expect(first).toBe(second);
    });

    it('does not throw on non-hex traceId', () => {
      config.traceSamplingRate = 50;

      expect(() => sampler.shouldSampleTrace('not-a-trace-id')).not.toThrow();

      const first = sampler.shouldSampleTrace('not-a-trace-id');
      const second = sampler.shouldSampleTrace('not-a-trace-id');
      expect(first).toBe(second);
    });

    it('handles short traceIds safely', () => {
      config.traceSamplingRate = 50;

      expect(() => sampler.shouldSampleTrace('abc')).not.toThrow();
      expect(() => sampler.shouldSampleTrace('1234')).not.toThrow();
    });
  });

  describe('non-integer sampling rates', () => {
    it('handles fractional rates deterministically', () => {
      config.traceSamplingRate = 12.5;

      const traceId = '0123456789abcdef0123456789abcdef';

      const first = sampler.shouldSampleTrace(traceId);
      const second = sampler.shouldSampleTrace(traceId);

      expect(first).toBe(second);
    });

    it('handles high fractional rates', () => {
      config.traceSamplingRate = 99.9;

      const traceId = '00000000000000000000000000000001';
      expect(sampler.shouldSampleTrace(traceId)).toBe(true);
    });
  });

  describe('config updates after construction', () => {
    it('respects updated config values', () => {
      const traceId = '00000000000000000000000000000001';

      config.traceSamplingRate = 0;
      expect(sampler.shouldSampleTrace(traceId)).toBe(false);

      config.traceSamplingRate = 100;
      expect(sampler.shouldSampleTrace(traceId)).toBe(true);
    });
  });
});
