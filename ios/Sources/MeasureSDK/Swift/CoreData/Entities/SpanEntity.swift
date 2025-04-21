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
    let spanId: String
    let parentId: String?
    let sessionId: String?
    let startTime: Int64
    let startTimeString: String
    let endTime: Int64
    let endTimeString: String
    let duration: Int64
    let status: Int64?
    let attributes: Data?
    let userDefinedAttrs: Data?
    let checkpoints: Data?
    let hasEnded: Bool
    let isSampled: Bool
    var batchId: String?

    init(name: String?,
         traceId: String?,
         spanId: String,
         parentId: String?,
         sessionId: String?,
         startTime: Int64,
         startTimeString: String,
         endTime: Int64,
         endTimeString: String,
         duration: Int64,
         status: Int64?,
         attributes: Data?,
         userDefinedAttrs: Data?,
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
        self.startTimeString = startTimeString
        self.endTime = endTime
        self.endTimeString = endTimeString
        self.duration = duration
        self.status = status
        self.attributes = attributes
        self.userDefinedAttrs = userDefinedAttrs
        self.checkpoints = checkpoints
        self.hasEnded = hasEnded
        self.isSampled = isSampled
        self.batchId = batchId
    }

    init(_ spanData: SpanData, startTimeString: String, endTimeString: String) {
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
        if let userDefinedAttrs = spanData.userDefinedAttrs {
            let converted: [String: Any] = userDefinedAttrs.mapValues { $0.value }
            do {
                self.userDefinedAttrs = try JSONSerialization.data(withJSONObject: converted, options: [])
            } catch {
                self.userDefinedAttrs = nil
            }
        } else {
            self.userDefinedAttrs = nil
        }
        self.batchId = nil

        let encoder = JSONEncoder()
        self.attributes = try? encoder.encode(spanData.attributes)
        self.checkpoints = try? encoder.encode(spanData.checkpoints)
        self.startTimeString = startTimeString
        self.endTimeString = endTimeString
    }

    func toSpanDataCodable() -> SpanDataCodable {
        let decoder = JSONDecoder()

        let decodedAttributes: Attributes?
        if let attributesData = attributes {
            do {
                decodedAttributes = try decoder.decode(Attributes?.self, from: attributesData)
            } catch {
                decodedAttributes = nil
            }
        } else {
            decodedAttributes = nil
        }

        let decodedCheckpoints: [Checkpoint]
        if let checkpointsData = checkpoints {
            do {
                decodedCheckpoints = try decoder.decode([Checkpoint].self, from: checkpointsData)
            } catch {
                decodedCheckpoints = []
            }
        } else {
            decodedCheckpoints = []
        }

        let userDefinedAttributes: [String: AttributeValue]?
        if let userDefinedAttrs = self.userDefinedAttrs {
            do {
                let decoded = try JSONDecoder().decode([String: AttributeValue].self, from: userDefinedAttrs)
                userDefinedAttributes = decoded
            } catch {
                userDefinedAttributes = nil
            }
        } else {
            userDefinedAttributes = nil
        }

        return SpanDataCodable(name: name ?? "",
                               traceId: traceId ?? "",
                               spanId: spanId,
                               parentId: parentId,
                               sessionId: sessionId ?? "",
                               startTime: startTimeString,
                               endTime: endTimeString,
                               duration: duration,
                               status: SpanStatus(rawValue: status ?? 0) ?? .unset,
                               attributes: decodedAttributes ?? nil,
                               userDefinedAttrs: userDefinedAttributes,
                               checkpoints: decodedCheckpoints)
    }
}
