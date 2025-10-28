/**
 * Protocol for generating random numbers.
 */
export interface IRandomizer {
    /**
     * Returns a random number (float) between 0.0 (inclusive) and 1.0 (exclusive).
     */
    random(): number;

    /**
     * Returns a random 64-bit integer.
     * Note: In JavaScript/TypeScript, this will typically be a standard 53-bit safe number,
     * or a BigInt if true 64-bit range is required. Using 'number' here for simplicity.
     */
    nextLong(): number;
}

/**
 * A simple randomizer that uses the system's random number generator.
 */
export class Randomizer implements IRandomizer {

    /**
     * Returns a random number between 0.0 (inclusive) and 1.0 (exclusive).
     * This implementation uses the standard JavaScript Math.random().
     */
    public random(): number {
        return Math.random();
    }

    /**
     * Returns a random integer.
     * Note: This implementation generates a random number that fits within the standard
     * JavaScript 53-bit safe integer range, which is the practical limit for 'number'.
     */
    public nextLong(): number {
        return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }
}