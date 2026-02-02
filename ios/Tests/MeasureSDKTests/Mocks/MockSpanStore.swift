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

    func getSpans(spanIds: [String]) -> [SpanEntity]? {
        let result = spanIds.compactMap { spans[$0] }
        return result.isEmpty ? nil : result
    }

    func deleteSpans(spanIds: [String]) {
        for id in spanIds {
            spans.removeValue(forKey: id)
        }
    }

    func deleteSpans(sessionIds: [String]) {
        spans = spans.filter { _, span in
            guard let sessionId = span.sessionId else { return true }
            return !sessionIds.contains(sessionId)
        }
    }

    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) -> [String] {
        let unbatched = spans.values.filter { $0.batchId == nil }

        let sorted = unbatched.sorted {
            ascending
                ? $0.startTime < $1.startTime
                : $0.startTime > $1.startTime
        }

        return Array(sorted.prefix(Int(spanCount))).map { $0.spanId }
    }

    func updateBatchId(_ batchId: String, for spanIds: [String]) {
        for id in spanIds {
            guard var span = spans[id] else { continue }
            span.batchId = batchId
            spans[id] = span
        }
    }

    func getSpansCount() -> Int {
        spans.count
    }

    func getSpansCount(sessionId: String) -> Int {
        spans.values.filter { $0.sessionId == sessionId }.count
    }

    func getAllSpans() -> [SpanEntity] {
        return Array(spans.values)
    }
}
