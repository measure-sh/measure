//
//  MockTracer.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 24/04/25.
//

import Foundation
@testable import Measure

final class MockTracer: Tracer {
    private(set) var lastSpan: MockSpan?
    private(set) var spans: [MockSpan] = []
    private(set) var spanBuilder: MockSpanBuilder?
    
    func spanBuilder(name: String) -> any SpanBuilder {
        let builder = MockSpanBuilder(name: name, tracer: self)
        spanBuilder = builder
        return builder
    }
    
    func getTraceParentHeaderValue(for span: any Span) -> String {
        return "00-\(span.traceId)-\(span.spanId)-01"
    }
    
    func getTraceParentHeaderKey() -> String {
        return "traceparent"
    }
    
    func addSpan(_ span: MockSpan) {
        lastSpan = span
        spans.append(span)
    }
    
    func reset() {
        lastSpan = nil
        spans.removeAll()
        spanBuilder = nil
    }
}

final class MockSpanBuilder: SpanBuilder {
    private let name: String
    private let tracer: MockTracer
    private var parentSpan: MockSpan?
    private var attributes: [String: AttributeValue] = [:]
    
    init(name: String, tracer: MockTracer) {
        self.name = name
        self.tracer = tracer
    }
    
    func setParent(_ span: any Span) -> any SpanBuilder {
        parentSpan = span as? MockSpan
        return self
    }
    
    func startSpan() -> any Span {
        return startSpan(Int64(Date().timeIntervalSince1970 * 1000))
    }
    
    func startSpan(_ timestamp: Int64) -> any Span {
        let span = MockSpan(
            name: name,
            parent: parentSpan,
            attributes: attributes,
            startTime: timestamp
        )
        tracer.addSpan(span)
        return span
    }
}

final class MockSpan: Span {
    private(set) var name: String
    private(set) var parent: MockSpan?
    private(set) var attributes: [String: AttributeValue]
    private(set) var status: SpanStatus = .unset
    private(set) var checkpoints: [String: Int64] = [:]
    private(set) var isEnded = false
    private(set) var startTime: Int64
    private(set) var endTime: Int64?
    
    let traceId: String
    let spanId: String
    var parentId: String?
    let isSampled: Bool
    
    init(name: String, parent: MockSpan?, attributes: [String: AttributeValue], startTime: Int64) {
        self.name = name
        self.parent = parent
        self.attributes = attributes
        self.startTime = startTime
        self.traceId = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        self.spanId = UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(16).description
        self.parentId = parent?.spanId
        self.isSampled = true
    }
    
    func setStatus(_ status: SpanStatus) -> any Span {
        self.status = status
        return self
    }
    
    func setParent(_ parentSpan: any Span) -> any Span {
        self.parent = parentSpan as? MockSpan
        self.parentId = parentSpan.spanId
        return self
    }
    
    func setCheckpoint(_ name: String) -> any Span {
        checkpoints[name] = Int64(Date().timeIntervalSince1970 * 1000)
        return self
    }
    
    func setName(_ name: String) -> any Span {
        self.name = name
        return self
    }
    
    func setAttribute(_ key: String, value: String) -> any Span {
        attributes[key] = .string(value)
        return self
    }
    
    func setAttribute(_ key: String, value: Int) -> any Span {
        attributes[key] = .int(value)
        return self
    }
    
    func setAttribute(_ key: String, value: Double) -> any Span {
        attributes[key] = .double(value)
        return self
    }
    
    func setAttribute(_ key: String, value: Bool) -> any Span {
        attributes[key] = .boolean(value)
        return self
    }
    
    func setAttributes(_ attributes: [String: AttributeValue]) -> any Span {
        self.attributes.merge(attributes) { $1 }
        return self
    }
    
    func removeAttribute(_ key: String) -> any Span {
        attributes.removeValue(forKey: key)
        return self
    }
    
    func end() -> any Span {
        return end(timestamp: Int64(Date().timeIntervalSince1970 * 1000))
    }
    
    func end(timestamp: Int64) -> any Span {
        isEnded = true
        endTime = timestamp
        return self
    }
    
    func hasEnded() -> Bool {
        return isEnded
    }
    
    func getDuration() -> Int64 {
        guard let endTime = endTime else { return 0 }
        return endTime - startTime
    }
}
