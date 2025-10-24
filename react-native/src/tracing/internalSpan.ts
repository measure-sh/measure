import type { Attributes } from "../attributes/attributes";
import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { Checkpoint } from "./checkpoint";
import type { Span } from "./span";
import type { SpanData } from "./spanData";
import type { SpanStatus } from "./spanStatus";

export interface InternalSpan extends Span {
    /**
     * Gets the name identifying this span.
     */
    readonly name: string;

    /**
     * Gets the session identifier associated with this span. A v4-UUID string.
     */
    readonly sessionId: string;

    /**
     * Gets the timestamp when this span was started.
     * Note: Swift's 'Number' is mapped to 'number' in TypeScript.
     */
    readonly startTime: number;

    /**
     * Gets the list of time-based checkpoints added to this span.
     */
    readonly checkpoints: Checkpoint[];

    /**
     * Gets the map of all attributes attached to this span (including internal ones).
     * Returns null if no attributes are set.
     */
    readonly attributes: Attributes | null;

    /**
     * Gets the current status of this span, indicating its outcome or error state.
     * @returns The current SpanStatus.
     */
    getStatus(): SpanStatus;

    /**
     * Returns a modifiable map (object) of user-defined attributes.
     * @returns A map of user-defined attributes.
     */
    getUserDefinedAttrs(): { [key: string]: ValidAttributeValue };

    /**
     * Adds an attribute intended for internal SDK use to this span.
     * @param attribute The attribute to set (often used for merging internal data).
     */
    setInternalAttribute(attribute: Attributes): void; // Note: Typically setters don't return Span for chaining unless public API

    /**
     * Converts the span to a data class for further processing and export.
     * @returns A complete SpanData structure ready for serialization.
     */
    toSpanData(): SpanData;
}