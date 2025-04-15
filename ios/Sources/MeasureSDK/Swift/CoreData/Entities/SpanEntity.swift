//
//  SpanEntity.swift
//  Measure
//
//  Created by Adwin Ross on 14/04/25.
//

import Foundation

struct SpanEntity {
    let name: String?
    let traceId: String?
    let spanId: String?
    let parentId: String?
    let sessionId: String?
    let startTime: Int64
    let endTime: Int64
    let duration: Int64
    let status: Int64?
    let attributes: Data?
    let userDefinedAttrs: String?
    let checkpoints: Data?
    let hasEnded: Bool
    let isSampled: Bool
    var batchId: String?

    init(name: String?,
         traceId: String?,
         spanId: String?,
         parentId: String?,
         sessionId: String?,
         startTime: Int64,
         endTime: Int64,
         duration: Int64,
         status: Int64?,
         attributes: Data?,
         userDefinedAttrs: String?,
         checkpoints: Data?,
         hasEnded: Bool,
         isSampled: Bool,
         batchId: String?) {
        self.name = name
        self.traceId = traceId
        self.spanId = spanId
        self.parentId = parentId
        self.sessionId = sessionId
        self.startTime = startTime
        self.endTime = endTime
        self.duration = duration
        self.status = status
        self.attributes = attributes
        self.userDefinedAttrs = userDefinedAttrs
        self.checkpoints = checkpoints
        self.hasEnded = hasEnded
        self.isSampled = isSampled
        self.batchId = batchId
    }

    init(_ spanData: SpanData) {
        self.name = spanData.name
        self.traceId = spanData.traceId
        self.spanId = spanData.spanId
        self.parentId = spanData.parentId
        self.sessionId = spanData.sessionId
        self.startTime = spanData.startTime
        self.endTime = spanData.endTime
        self.duration = spanData.duration
        self.status = spanData.status.rawValue
        self.hasEnded = spanData.hasEnded
        self.isSampled = spanData.isSampled
        self.userDefinedAttrs = spanData.userDefinedAttrs
        self.batchId = nil

        let encoder = JSONEncoder()
        self.attributes = try? encoder.encode(spanData.attributes)
        self.checkpoints = try? encoder.encode(spanData.checkpoints)
    }

    func toSpanData() -> SpanData {
        let decoder = JSONDecoder()

        let decodedAttributes = try? attributes.flatMap { try decoder.decode(Attributes?.self, from: $0) }
        let decodedCheckpoints = try? checkpoints.flatMap { try decoder.decode([Checkpoint].self, from: $0) }

        return SpanData(
            name: name ?? "",
            traceId: traceId ?? "",
            spanId: spanId ?? "",
            parentId: parentId,
            sessionId: sessionId ?? "",
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            status: SpanStatus(rawValue: status ?? 0) ?? .unset,
            attributes: decodedAttributes ?? nil,
            userDefinedAttrs: userDefinedAttrs,
            checkpoints: decodedCheckpoints ?? [],
            hasEnded: hasEnded,
            isSampled: isSampled
        )
    }
}
