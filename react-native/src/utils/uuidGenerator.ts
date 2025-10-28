/**
 * Interface defining the contract for UUID generation.
 */
export interface IUuidGenerator {
    /**
     * Returns a type 4 UUID string.
     */
    v4(): string;
}

/**
 * Custom implementation of the UuidGenerator.
 */
export class UuidGenerator implements IUuidGenerator {
    // TODO: Replace with a more robust UUID generation method.
    v4(): string {
        return crypto.randomUUID();
    }
}