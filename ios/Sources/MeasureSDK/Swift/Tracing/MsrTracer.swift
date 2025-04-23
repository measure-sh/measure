//
//  MsrTracer.swift
//  Measure
//
//  Created by Adwin Ross on 10/04/25.
//

import Foundation

final class MsrTracer: Tracer {
    private let logger: Logger
    private let idProvider: IdProvider
    private let timeProvider: TimeProvider
    private let spanProcessor: SpanProcessor
    private let sessionManager: SessionManager
    private let traceSampler: TraceSampler

    init(logger: Logger,
         idProvider: IdProvider,
         timeProvider: TimeProvider,
         spanProcessor: SpanProcessor,
         sessionManager: SessionManager,
         traceSampler: TraceSampler) {
        self.logger = logger
        self.idProvider = idProvider
        self.timeProvider = timeProvider
        self.spanProcessor = spanProcessor
        self.sessionManager = sessionManager
        self.traceSampler = traceSampler
    }

    func spanBuilder(name: String) -> SpanBuilder {
        return MsrSpanBuilder(name: name,
                              idProvider: idProvider,
                              timeProvider: timeProvider,
                              spanProcessor: spanProcessor,
                              sessionManager: sessionManager,
                              traceSampler: traceSampler,
                              logger: logger)
    }

    func getTraceParentHeaderValue(for span: Span) -> String {
        let sampledFlag = span.isSampled ? "01" : "00"
        return "00-\(span.traceId)-\(span.spanId)-\(sampledFlag)"
    }

    func getTraceParentHeaderKey() -> String {
        return "traceparent"
    }
}
