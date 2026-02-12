import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { Checkpoint } from "./checkpoint";
import type { Span } from "./span";
import type { SpanData } from "./spanData";
import type { SpanStatus } from "./spanStatus";

export interface InternalSpan extends Span {
    /**
     * Gets the name identifying this span.
     */
    name: string;

    /**
     * Gets the timestamp when this span was started.
     */
    startTime: number;

    /**
     * Gets the list of time-based checkpoints added to this span.
     */
    checkpoints: Checkpoint[];

    /**
     * Gets the map of all attributes attached to this span (including internal ones).
     * Returns null if no attributes are set.
     */
    attributes: {[key: string]: any} | undefined;

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
    setInternalAttribute(attribute: {[key: string]: any}): void;

    /**
     * Converts the span to a data class for further processing and export.
     * @returns A complete SpanData structure ready for serialization.
     */
    toSpanData(): SpanData;

    /**
     * Marks the span as sampled or not sampled.
     * @param sampled true if the span is selected for export, false otherwise.
     */
    setSampled(sampled: boolean): void;
}