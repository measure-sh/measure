import type { IConfigProvider } from "../config/configProvider";

/**
 * Protocol for determining if a trace should be sampled.
 */
export interface ITraceSampler {
  shouldSampleTrace(traceId: string): boolean;
}

/**
 * Deterministic trace sampler based on traceId.
 */
export class TraceSampler implements ITraceSampler {
  private configProvider: IConfigProvider;

  constructor(configProvider: IConfigProvider) {
    this.configProvider = configProvider;
  }

  shouldSampleTrace(traceId: string): boolean {
    if (this.configProvider.enableFullCollectionMode) {
      return true;
    }
    const rate = this.configProvider.traceSamplingRate;

    if (rate === 0.0) {
      return false;
    }

    if (rate === 100.0) {
      return true;
    }

    // Convert percent to fraction
    const sampleRate = rate / 100;

    const idLo = this.longFromBase16String(traceId, 16);

    const mask = BigInt("0x7FFFFFFFFFFFFFFF");
    const threshold = BigInt(Math.floor(Number(mask) * sampleRate));

    return (idLo & mask) < threshold;
  }

  /**
   * Converts lower 64 bits of hex traceId to BigInt.
   */
  private longFromBase16String(input: string, index: number): bigint {
    if (index < 0 || index >= input.length) {
      return BigInt(0);
    }

    const endIndex = Math.min(index + 16, input.length);
    const hexSubstring = input.substring(index, endIndex);

    try {
      return BigInt("0x" + hexSubstring);
    } catch {
      return BigInt(0);
    }
  }
}