import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { Span } from "./span";
import type { SpanStatus } from "./spanStatus";

/**
 * An invalid span implementation that does nothing (No-Op Span).
 * Used when tracing is disabled or a valid span could not be created.
 */
export class InvalidSpan implements Span {
    traceId: string = "invalid-trace-id";
    spanId: string = "invalid-span-id";
    isSampled: boolean = false;
    parentId: string | undefined = undefined;
    
    setStatus(_status: SpanStatus): Span { return this; }
    setParent(_parentSpan: Span): Span { return this; }
    setCheckpoint(_name: string): Span { return this; }
    setName(_name: string): Span { return this; }
    setAttribute(_key: string, _value: string | number | boolean): Span { return this; }
    setAttributes(_attributes: { [key: string]: ValidAttributeValue }): Span { return this; }
    removeAttribute(_key: string): Span { return this; }
    end(_timestampMs?: number): Span { return this; }
    hasEnded(): boolean { return false; }
    getDuration(): number { return 0; }
}