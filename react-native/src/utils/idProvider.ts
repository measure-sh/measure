import type { IRandomizer } from "./randomizer";
import { type IUuidGenerator } from "./uuidGenerator";

/**
 * Abstract class defining the contract for generating tracing and session identifiers.
 */
export abstract class IIdProvider {
    /** Returns a type 4 (pseudo randomly generated) UUID. */
    public abstract uuid(): string;

    /** Generates a new valid span ID (16 hex characters). */
    public abstract spanId(): string;

    /** Generates a new valid trace ID (32 hex characters). */
    public abstract traceId(): string;
}

// ----------------------------------------------------------------------

/**
 * Concrete implementation of the IdProvider, responsible for generating
 * unique trace, span, and session IDs.
 */
export class IdProvider extends IIdProvider {
    private readonly _randomizer: IRandomizer;
    private readonly _uuidGenerator: IUuidGenerator;

    /**
     * @param randomizer The random number generator used for trace and span IDs.
     * @param uuidGenerator The generator used for UUIDs. Defaults to a custom v4 implementation.
     */
    constructor(randomizer: IRandomizer, uuidGenerator: IUuidGenerator) {
        super();
        this._randomizer = randomizer;
        this._uuidGenerator = uuidGenerator;
    }

    public uuid(): string {
        return this._uuidGenerator.v4();
    }

    public spanId(): string {
        let id: string;
        do {
            // Span ID is 8 bytes (64-bit) = 16 hex characters
            id = this._randomHex(8);
        } while (this._isAllZero(id));
        return id;
    }

    public traceId(): string {
        let id: string;
        do {
            // Trace ID is 16 bytes (128-bit) = 32 hex characters
            id = this._randomHex(16);
        } while (this._isAllZero(id));
        return id;
    }

    /**
     * Generates a random hexadecimal string of the specified byte length.
     * It uses the Randomizer's float 'random()' method to simulate getting a random byte.
     */
    private _randomHex(byteLength: number): string {
        let hex = '';
        for (let i = 0; i < byteLength; i++) {
            // Generate a random byte (0 to 255)
            const byte = Math.floor(this._randomizer.random() * 256);

            // Convert byte to 2-character hex string, padding with '0'
            hex += byte.toString(16).padStart(2, '0');
        }
        return hex;
    }

    /**
     * Checks if a hex string consists only of '0' characters (which is an invalid ID).
     */
    private _isAllZero(hex: string): boolean {
        return /^0+$/.test(hex);
    }
}