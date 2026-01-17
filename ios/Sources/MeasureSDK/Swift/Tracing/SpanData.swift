//
//  SpanData.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// Data class representing a span's data for processing and export.
struct SpanData {
    let name: String
    let traceId: String
    let spanId: String
    let parentId: String?
    let sessionId: String
    let startTime: Number
    let endTime: Number
    let duration: Number
    let status: SpanStatus
    let attributes: Attributes?
    let userDefinedAttrs: [String: AttributeValue]?
    let checkpoints: [Checkpoint]
    let hasEnded: Bool
    let isSampled: Bool
}

struct SpanDataCodable: Codable {
    let name: String
    let traceId: String
    let spanId: String
    let parentId: String?
    let sessionId: String
    let startTime: String
    let endTime: String
    let duration: Number
    let status: SpanStatus
    let attributes: Attributes?
    let userDefinedAttrs: [String: AttributeValue]?
    let checkpoints: [Checkpoint]

    enum CodingKeys: String, CodingKey {
        case name
        case traceId = "trace_id"
        case spanId = "span_id"
        case parentId = "parent_id"
        case sessionId = "session_id"
        case startTime = "start_time"
        case endTime = "end_time"
        case duration
        case status
        case attributes
        case userDefinedAttrs = "user_defined_attribute"
        case checkpoints
    }
}
