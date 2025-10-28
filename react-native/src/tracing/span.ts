import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { SpanStatus } from "./spanStatus";

/**
 * Represents a unit of work or operation within a trace.
 *
 * A span represents a single operation within a trace. Spans can be nested to form
 * a trace tree that represents the end-to-end execution path of an operation.
 * Each span captures timing data, status, parent-child relationships to provide context
 * about the operation.
 */
export interface Span {
    /**
     * Gets the unique identifier for the trace this span belongs to.
     * @returns A unique string identifier generated when the root span of this trace was created.
     */
    traceId: string;

    /**
     * Gets the unique identifier for this span.
     * @returns A unique string identifier generated when this span was created.
     */
    spanId: string;

    /**
     * Gets the span ID of this span's parent, if one exists.
     * @returns The unique identifier of the parent span, or undefined/null if this is a root span.
     */
    parentId: string | undefined;

    /**
     * Indicates whether this span has been selected for collection and export.
     * @returns true if this span will be sent to the server for analysis, false if it will be dropped.
     */
    isSampled: boolean;

    /**
     * Updates the status of this span.
     * @param status The SpanStatus to set for this span.
     * @returns The Span instance for method chaining.
     * Note: This operation has no effect if called after the span has ended.
     */
    setStatus(status: SpanStatus): Span;

    /**
     * Sets the parent span for this span, establishing a hierarchical relationship.
     * @param parentSpan The span to set as the parent of this span.
     * @returns The Span instance for method chaining.
     * Note: This operation has no effect if called after the span has ended.
     */
    setParent(parentSpan: Span): Span;

    /**
     * Adds a checkpoint marking a significant moment during the span's lifetime.
     * @param name A descriptive name for this checkpoint, indicating what it represents.
     * @returns The Span instance for method chaining.
     * Note: This operation has no effect if called after the span has ended.
     */
    setCheckpoint(name: string): Span;

    /**
     * Updates the name of the span.
     * @param name The name to identify this span.
     * @returns The Span instance for method chaining.
     * Note: This operation has no effect if called after the span has ended.
     */
    setName(name: string): Span;

    /**
     * Adds an attribute to this span.
     * @param key The name of the attribute.
     * @param value The value of the attribute (string, number, or boolean).
     * @returns The Span instance for method chaining.
     */
    setAttribute(key: string, value: ValidAttributeValue): Span;

    /**
     * Adds multiple attributes to this span.
     * @param attributes A dictionary (object) of attribute names to AttributeValue.
     * @returns The Span instance for method chaining.
     */
    setAttributes(attributes: { [key: string]: ValidAttributeValue }): Span;

    /**
     * Removes an attribute from this span. No-op if the attribute does not exist.
     * @param key The name of the attribute to remove.
     * @returns The Span instance for method chaining.
     */
    removeAttribute(key: string): Span;

    /**
     * Marks this span as completed, recording its end time (current time).
     * @returns The Span instance for method chaining.
     * Note: This method can be called only once per span. Subsequent calls will have no effect.
     */
    end(): Span;

    /**
     * Marks this span as completed using the specified end time.
     * @param timestampMs The end time in milliseconds since epoch (Int64 in Swift -> number in TS).
     * @returns The Span instance for method chaining.
     * Note: This method can be called only once per span. Subsequent calls will have no effect.
     */
    end(timestampMs: number): Span;

    /**
     * Checks if this span has been completed.
     * @returns true if end() has been called on this span, false otherwise.
     */
    hasEnded(): boolean;

    /**
     * Gets the total duration of this span in milliseconds.
     * @returns The time elapsed between span start and end in milliseconds, or 0 if the span hasn't ended yet.
     */
    getDuration(): number;
}