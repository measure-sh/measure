//
//  InvalidSpan.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// An invalid span implementation that does nothing.
final class InvalidSpan: Span {
    let traceId: String = "invalid-trace-id"
    let spanId: String = "invalid-span-id"
    let isSampled: Bool = false
    let parentId: String? = nil

    func setStatus(_ status: SpanStatus) -> Span { return self }
    func setParent(_ parentSpan: Span) -> Span { return self }
    func setCheckpoint(_ name: String) -> Span { return self }
    func setName(_ name: String) -> Span { return self }
    func setAttribute(_ key: String, value: String) -> Span { return self }
    func setAttribute(_ key: String, value: Int) -> Span { return self }
    func setAttribute(_ key: String, value: Double) -> Span { return self }
    func setAttribute(_ key: String, value: Bool) -> Span { return self }
    func setAttributes(_ attributes: [String: Any]) -> Span { return self }
    func removeAttribute(_ key: String) -> Span { return self }
    func end() -> Span { return self }
    func end(timestamp: Number) -> Span { return self }
    func hasEnded() -> Bool { return false }
    func getDuration() -> Int64 { return 0 }
}
