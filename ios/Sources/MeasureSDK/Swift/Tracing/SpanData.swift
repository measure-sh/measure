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
    let attributes: [String: Any]
    let userDefinedAttrs: [String: Any]
    let checkpoints: [Checkpoint]
    let hasEnded: Bool
    let isSampled: Bool
}
