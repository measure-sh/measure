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

    func insertSpans(spans: [SpanEntity]) {
        for span in spans {
            self.spans[span.spanId] = span
        }
    }

    func getSpans(spanIds: [String]) -> [SpanEntity]? {
        let result = spanIds.compactMap { spans[$0] }
        return result.isEmpty ? nil : result
    }

    func getSpansForSessions(sessions: [String]) -> [SpanEntity]? {
        let result = spans.values.filter {
            guard let sessionId = $0.sessionId else { return false }
            return sessions.contains(sessionId)
        }
        return result.isEmpty ? nil : result
    }

    func getAllSpans(completion: @escaping ([SpanEntity]?) -> Void) {
        completion(spans.isEmpty ? nil : Array(spans.values))
    }

    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) -> [String] {
        let filtered = spans.values.filter { $0.batchId == nil }

        let sorted = filtered.sorted {
            ascending
            ? $0.startTime < $1.startTime
            : $0.startTime > $1.startTime
        }

        return sorted
            .prefix(Int(spanCount))
            .compactMap { $0.spanId }
    }

    func deleteSpans(spanIds: [String]) {
        for id in spanIds {
            spans.removeValue(forKey: id)
        }
    }

    func deleteSpans(sessionIds: [String], completion: @escaping () -> Void) {
        spans = spans.filter { _, span in
            guard let sessionId = span.sessionId else { return true }
            return !sessionIds.contains(sessionId)
        }
        completion()
    }

    func updateBatchId(_ batchId: String, for spansToUpdate: [String]) {
        for spanId in spansToUpdate {
            guard let span = spans[spanId] else { continue }

            spans[spanId] = SpanEntity(
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
        }
    }

    func getSpansCount(completion: @escaping (Int) -> Void) {
        completion(spans.count)
    }
}
