import type { Attributes } from "../attributes/attributes";
import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { IIdProvider } from "../utils/idProvider";
import type { Logger } from "../utils/logger";
import type { TimeProvider } from "../utils/timeProvider";
import type { Checkpoint } from "./checkpoint";
import type { InternalSpan } from "./internalSpan";
import type { Span } from "./span";
import type { SpanData } from "./spanData";
import type { ISpanProcessor, SpanProcessor } from "./spanProcessor";
import { EndState, SpanStatus } from "./spanStatus";
import type { ITraceSampler } from "./traceSampler";

export class MsrSpan implements InternalSpan {
    private readonly logger: Logger;
    private readonly timeProvider: TimeProvider;
    private readonly spanProcessor: ISpanProcessor;

    isSampled: boolean;
    name: string;
    spanId: string;
    traceId: string;
    parentId: string | undefined;
    startTime: number;

    status: SpanStatus = SpanStatus.Unset;
    endTime: number = 0;
    hasEndedState: EndState = EndState.NotEnded;
    checkpoints: Checkpoint[] = [];
    attributes: Attributes | undefined;
    userDefinedAttrs: Record<string, ValidAttributeValue> = {};

    constructor(
        logger: Logger,
        timeProvider: TimeProvider,
        isSampled: boolean,
        name: string,
        spanId: string,
        traceId: string,
        parentId: string | undefined,
        startTime: number,
        spanProcessor: ISpanProcessor
    ) {
        this.logger = logger;
        this.timeProvider = timeProvider;
        this.isSampled = isSampled;
        this.name = name;
        this.spanId = spanId;
        this.traceId = traceId;
        this.parentId = parentId;
        this.startTime = startTime;
        this.spanProcessor = spanProcessor;
    }

    static startSpan({
        name,
        logger,
        timeProvider,
        idProvider,
        traceSampler,
        parentSpan,
        spanProcessor,
        timestamp = timeProvider.now(),
    }: {
        name: string;
        logger: Logger;
        timeProvider: TimeProvider;
        idProvider: IIdProvider;
        traceSampler: ITraceSampler;
        parentSpan?: Span;
        spanProcessor: ISpanProcessor;
        timestamp?: number;
    }): Span {
        const startTime = timestamp;
        const spanId = idProvider.spanId();
        const traceId = parentSpan?.traceId ?? idProvider.traceId();
        const isSampled = parentSpan?.isSampled ?? traceSampler.shouldSample();

        const span = new MsrSpan(
            logger,
            timeProvider,
            isSampled,
            name,
            spanId,
            traceId,
            parentSpan?.spanId,
            startTime,
            spanProcessor
        );

        spanProcessor.onStart(span);
        return span;
    }

    public getStatus(): SpanStatus {
        return this.status;
    }

    public getUserDefinedAttrs(): Record<string, ValidAttributeValue> {
        return this.userDefinedAttrs;
    }

    public setInternalAttribute(attribute: Attributes): void {
        this.attributes = attribute;
    }

    public setStatus(status: SpanStatus): Span {
        if (this.hasEndedState === EndState.NotEnded) {
            this.status = status;
        }
        return this;
    }

    public setParent(parentSpan: Span): Span {
        if (this.hasEndedState === EndState.NotEnded) {
            this.parentId = parentSpan.spanId;
            this.traceId = parentSpan.traceId;
        }
        return this;
    }

    public setCheckpoint(name: string): Span {
        if (this.hasEndedState === EndState.NotEnded) {
            const timestamp = this.timeProvider.iso8601Timestamp(this.timeProvider.now());
            const checkpoint: Checkpoint = { name, timestamp };
            this.checkpoints.push(checkpoint);
        }
        return this;
    }

    public setName(name: string): Span {
        if (this.hasEndedState === EndState.NotEnded) {
            this.name = name;
        }
        return this;
    }

    public setAttribute(key: string, value: ValidAttributeValue): Span {
        if (this.hasEndedState === EndState.NotEnded) {
            let attrValue: ValidAttributeValue;
            // Simplified type-to-AttributeValue mapping
            if (typeof value === 'string') attrValue = { type: 'string', value } as unknown as ValidAttributeValue;
            else if (typeof value === 'number') attrValue = { type: 'double', value } as unknown as ValidAttributeValue;
            else if (typeof value === 'boolean') attrValue = { type: 'boolean', value } as unknown as ValidAttributeValue;
            else return this;

            this.userDefinedAttrs[key] = attrValue;
        }
        return this;
    }

    public setAttributes(attributes: Record<string, ValidAttributeValue>): Span {
        if (this.hasEndedState === EndState.NotEnded) {
            Object.assign(this.userDefinedAttrs, attributes);
        }
        return this;
    }

    public removeAttribute(key: string): Span {
        if (this.hasEndedState === EndState.NotEnded) {
            delete this.userDefinedAttrs[key];
        }
        return this;
    }

    public end(timestamp?: number): Span {
        if (this.hasEndedState !== EndState.NotEnded) {
            return this;
        }

        this.hasEndedState = EndState.Ending;
        this.endTime = timestamp ?? this.timeProvider.now();
        this.spanProcessor.onEnding(this);

        this.hasEndedState = EndState.Ended;
        this.spanProcessor.onEnded(this);
        return this;
    }

    public hasEnded(): boolean {
        return this.hasEndedState === EndState.Ended;
    }

    public getDuration(): number {
        return this.calculateDuration();
    }

    public toSpanData(): SpanData {
        return {
            name: this.name,
            traceId: this.traceId,
            spanId: this.spanId,
            parentId: this.parentId,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.calculateDuration(),
            status: this.status,
            attributes: this.attributes,
            userDefinedAttrs: this.userDefinedAttrs,
            checkpoints: this.checkpoints,
            hasEnded: this.hasEndedState === EndState.Ended,
            isSampled: this.isSampled,
        };
    }

    private calculateDuration(): number {
        if (this.hasEndedState === EndState.Ended) {
            return this.endTime - this.startTime;
        }
        return 0;
    }
}