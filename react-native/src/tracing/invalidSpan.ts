import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { Span } from "./span";
import type { SpanStatus } from "./spanStatus";

/**
 * An invalid span implementation that does nothing (No-Op Span).
 * Used when tracing is disabled or a valid span could not be created.
 */
export class InvalidSpan implements Span {
    public readonly traceId: string = "invalid-trace-id";
    public readonly spanId: string = "invalid-span-id";
    public readonly isSampled: boolean = false;
    public readonly parentId: string | undefined = undefined;
    
    public setStatus(_status: SpanStatus): Span { return this; }
    public setParent(_parentSpan: Span): Span { return this; }
    public setCheckpoint(_name: string): Span { return this; }
    public setName(_name: string): Span { return this; }
    public setAttribute(_key: string, _value: string | number | boolean): Span { return this; }
    public setAttributes(_attributes: { [key: string]: ValidAttributeValue }): Span { return this; }
    public removeAttribute(_key: string): Span { return this; }
    public end(_timestampMs?: number): Span { return this; }
    public hasEnded(): boolean { return false; }
    public getDuration(): number { return 0; }
}