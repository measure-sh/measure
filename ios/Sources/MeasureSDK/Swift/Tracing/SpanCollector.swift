//
//  SpanCollector.swift
//  Measure
//
//  Created by Adwin Ross on 10/04/25.
//

import Foundation

protocol SpanCollector {
    func enable()
    func disabled()
    func getTraceParentHeaderValue(for span: Span) -> String
    func getTraceParentHeaderKey() -> String
    func createSpan(name: String) -> SpanBuilder?
    func startSpan(name: String, timestamp: Int64?) -> Span
}

final class BaseSpanCollector: SpanCollector {
    private let tracer: Tracer
    private var isEnabled = AtomicBool(false)

    init(tracer: Tracer) {
        self.tracer = tracer
    }

    func enable() {
        isEnabled.set(true)
    }

    func disabled() {
        isEnabled.set(false)
    }

    func getTraceParentHeaderValue(for span: Span) -> String {
        return tracer.getTraceParentHeaderValue(for: span)
    }

    func getTraceParentHeaderKey() -> String {
        return tracer.getTraceParentHeaderKey()
    }

    func createSpan(name: String) -> SpanBuilder? {
        guard isEnabled.get() else {
            return nil
        }
        return tracer.spanBuilder(name: name)
    }

    func startSpan(name: String, timestamp: Int64?) -> Span {
        guard isEnabled.get() else {
            return InvalidSpan()
        }

        let spanBuilder = tracer.spanBuilder(name: name)
        if let timestampMs = timestamp {
            return spanBuilder.startSpan(timestampMs)
        }
        return spanBuilder.startSpan()
    }
}
