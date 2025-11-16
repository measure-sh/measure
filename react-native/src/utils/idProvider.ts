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

/**
 * Concrete implementation of the IdProvider, responsible for generating
 * unique trace, span, and session IDs.
 */
export class IdProvider extends IIdProvider {
    private readonly _randomizer: IRandomizer;
    private readonly _uuidGenerator: IUuidGenerator;

    /**
     * @param randomizer The random number generator used for trace and span IDs.
     * @param uuidGenerator The generator used for UUIDs.
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
            id = this._randomHex(8);   // 8 bytes → 16 hex chars
        } while (this._isAllZero(id));
        return id;
    }

    public traceId(): string {
        let id: string;
        do {
            id = this._randomHex(16);  // 16 bytes → 32 hex chars
        } while (this._isAllZero(id));
        return id;
    }

    /**
     * Generates a random hexadecimal string of the specified byte length.
     * Uses crypto.getRandomValues if available, otherwise falls back to
     * the injected Randomizer.
     */
    private _randomHex(byteLength: number): string {
    const bytes: Uint8Array = new Uint8Array(byteLength);

    // Prefer secure RNG when available
    if (this._hasCrypto()) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < byteLength; i++) {
            bytes[i] = Math.floor(this._randomizer.random() * 256);
        }
    }

    // Convert bytes → hex safely
    let hex = "";
    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, "0");
    }

    return hex;
}

    /**
     * Detect if a hex string is all zeros.
     */
    private _isAllZero(hex: string): boolean {
        return /^0+$/.test(hex);
    }

    private _hasCrypto(): boolean {
        return (
            typeof globalThis !== "undefined" &&
            globalThis.crypto &&
            typeof globalThis.crypto.getRandomValues === "function"
        );
    }
}