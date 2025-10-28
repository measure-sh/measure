import type { ConfigProvider } from "../config/configProvider";
import type { Randomizer } from "../utils/randomizer";

/**
 * Protocol for determining if a span should be sampled.
 */
export interface ITraceSampler {
    /**
     * Determines if a span should be sampled.
     * @returns true if the span should be sampled, false otherwise.
     */
    shouldSample(): boolean;
}

/**
 * A simple trace sampler that uses a fixed sampling rate.
 */
export class TraceSampler implements ITraceSampler {
    // The properties are marked as 'private' and 'readonly' to mirror the Swift 'let' behavior
    // and encapsulation.
    private readonly configProvider: ConfigProvider;
    private readonly randomizer: Randomizer;

    /**
     * Initializes the BaseTraceSampler.
     * @param configProvider Provides the trace sampling rate.
     * @param randomizer Provides a random number for sampling decisions.
     */
    constructor(configProvider: ConfigProvider, randomizer: Randomizer) {
        this.configProvider = configProvider;
        this.randomizer = randomizer;
    }

    /**
     * Determines if a span should be sampled based on the configured rate.
     * Sampling logic:
     * - Rate 0.0: Never samples.
     * - Rate 1.0: Always samples.
     * - Rate (0.0, 1.0): Samples if a random number is less than the rate.
     * @returns true if the span should be sampled, false otherwise.
     */
    shouldSample(): boolean {
        const rate = this.configProvider.traceSamplingRate;

        if (rate === 0.0) {
            return false;
        }

        if (rate === 1.0) {
            return true;
        }

        // Generate a random number [0, 1) and compare it to the rate.
        return this.randomizer.random() < rate;
    }
}