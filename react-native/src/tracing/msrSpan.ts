import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { IIdProvider } from "../utils/idProvider";
import type { TimeProvider } from "../utils/timeProvider";
import type { Checkpoint } from "./checkpoint";
import type { InternalSpan } from "./internalSpan";
import type { Span } from "./span";
import type { SpanData } from "./spanData";
import type { ISpanProcessor } from "./spanProcessor";
import { EndState, SpanStatus } from "./spanStatus";
import type { ITraceSampler } from "./traceSampler";

export class MsrSpan implements InternalSpan {
  timeProvider: TimeProvider;
  spanProcessor: ISpanProcessor;

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
  attributes: { [key: string]: any } | undefined;
  userDefinedAttrs: Record<string, ValidAttributeValue> = {};

  constructor(
    timeProvider: TimeProvider,
    isSampled: boolean,
    name: string,
    spanId: string,
    traceId: string,
    parentId: string | undefined,
    startTime: number,
    spanProcessor: ISpanProcessor
  ) {
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
    timeProvider,
    idProvider,
    traceSampler,
    parentSpan,
    spanProcessor,
    timestamp = timeProvider.now(),
  }: {
    name: string;
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
    const isSampled = parentSpan?.isSampled ?? traceSampler.shouldSampleTrace(traceId);

    const span = new MsrSpan(
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

  getStatus(): SpanStatus {
    return this.status;
  }

  getUserDefinedAttrs(): Record<string, ValidAttributeValue> {
    return this.userDefinedAttrs;
  }

  setInternalAttribute(attribute: { [key: string]: any }): void {
    this.attributes = attribute;
  }

  setStatus(status: SpanStatus): Span {
    if (this.hasEndedState === EndState.NotEnded) {
      this.status = status;
    }
    return this;
  }

  setParent(parentSpan: Span): Span {
    if (this.hasEndedState === EndState.NotEnded) {
      this.parentId = parentSpan.spanId;
      this.traceId = parentSpan.traceId;
    }
    return this;
  }

  setCheckpoint(name: string): Span {
    if (this.hasEndedState === EndState.NotEnded) {
      const timestamp = this.timeProvider.now();
      const checkpoint: Checkpoint = { name, timestamp };
      this.checkpoints.push(checkpoint);
    }
    return this;
  }

  setName(name: string): Span {
    if (this.hasEndedState === EndState.NotEnded) {
      this.name = name;
    }
    return this;
  }

  setAttribute(key: string, value: ValidAttributeValue): Span {
    if (this.hasEndedState === EndState.NotEnded) {
      this.userDefinedAttrs[key] = value;
    }
    return this;
  }

  setAttributes(attributes: Record<string, ValidAttributeValue>): Span {
    if (this.hasEndedState === EndState.NotEnded) {
      Object.assign(this.userDefinedAttrs, attributes);
    }
    return this;
  }

  removeAttribute(key: string): Span {
    if (this.hasEndedState === EndState.NotEnded) {
      delete this.userDefinedAttrs[key];
    }
    return this;
  }

  end(timestamp?: number): Span {
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

  hasEnded(): boolean {
    return this.hasEndedState === EndState.Ended;
  }

  getDuration(): number {
    return this.calculateDuration();
  }

  setSampled(sampled: boolean): void {
    this.isSampled = sampled;
  }

  toSpanData(): SpanData {
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
