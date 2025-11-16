import type { ValidAttributeValue } from "../utils/attributeValueValidator";
import type { Checkpoint } from "./checkpoint";
import type { SpanStatus } from "./spanStatus";

export interface SpanData {
    name: string;
    traceId: string;
    spanId: string;
    parentId?: string;
    startTime: number;
    endTime: number;
    duration: number;
    status: SpanStatus;
    attributes?: {[key: string]: any};
    userDefinedAttrs?: { [key: string]: ValidAttributeValue };
    checkpoints: Checkpoint[];
    hasEnded: boolean;
    isSampled: boolean;
}

export interface SpanDataCodable {
    name: string;
    trace_id: string;
    span_id: string;
    parent_id?: string;
    start_time: string;
    end_time: string;
    duration: number;
    status: SpanStatus;
    attributes?: {[key: string]: any};
    user_defined_attribute?: { [key: string]: ValidAttributeValue };
    checkpoints: Checkpoint[];
}