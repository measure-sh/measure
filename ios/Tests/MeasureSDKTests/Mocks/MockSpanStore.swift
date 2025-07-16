//
//  MockSpanStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 16/04/25.
//

import Foundation
@testable import Measure

final class MockSpanStore: SpanStore {
    private var spans: [String: SpanEntity] = [:]

    func insertSpan(span: SpanEntity) {
        spans[span.spanId] = span
    }

    func getSpansForSessions(sessions: [String]) -> [SpanEntity]? {
        return spans.values.filter { span in
            guard let sessionId = span.sessionId else { return false }
            return sessions.contains(sessionId)
        }
    }

    func getSpans(spanIds: [String], completion: @escaping ([SpanEntity]?) -> Void) {
        completion(spanIds.compactMap { spans[$0] })
    }

    func getAllSpans(completion: @escaping ([SpanEntity]?) -> Void) {
        completion(Array(spans.values))
    }

    func getUnBatchedSpans(spanCount: Int64, ascending: Bool, completion: @escaping ([String]) -> Void) {
        let filtered = spans.values.filter { $0.batchId == nil }
        let sorted = filtered.sorted {
            if ascending {
                return $0.startTime < $1.startTime
            } else {
                return $0.startTime > $1.startTime
            }
        }
        completion(sorted.prefix(Int(spanCount)).compactMap { $0.spanId })
    }

    func deleteSpans(spanIds: [String]) {
        for id in spanIds {
            spans.removeValue(forKey: id)
        }
    }

    func deleteSpans(sessionIds: [String], completion: @escaping () -> Void) {
        for (key, span) in spans {
            if let sessionId = span.sessionId, sessionIds.contains(sessionId) {
                spans.removeValue(forKey: key)
            }
        }
        completion()
    }

    func updateBatchId(_ batchId: String, for spansToUpdate: [String]) {
        for spanId in spansToUpdate {
            guard var span = spans[spanId] else { continue }
            span = SpanEntity(
                name: span.name,
                traceId: span.traceId,
                spanId: span.spanId,
                parentId: span.parentId,
                sessionId: span.sessionId,
                startTime: span.startTime,
                startTimeString: span.startTimeString,
                endTime: span.endTime,
                endTimeString: span.endTimeString,
                duration: span.duration,
                status: span.status,
                attributes: span.attributes,
                userDefinedAttrs: span.userDefinedAttrs,
                checkpoints: span.checkpoints,
                hasEnded: span.hasEnded,
                isSampled: span.isSampled,
                batchId: batchId
            )
            spans[spanId] = span
        }
    }
}
