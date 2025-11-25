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
    private let signalSampler: SignalSampler

    init(logger: Logger,
         idProvider: IdProvider,
         timeProvider: TimeProvider,
         spanProcessor: SpanProcessor,
         sessionManager: SessionManager,
         signalSampler: SignalSampler) {
        self.logger = logger
        self.idProvider = idProvider
        self.timeProvider = timeProvider
        self.spanProcessor = spanProcessor
        self.sessionManager = sessionManager
        self.signalSampler = signalSampler
    }

    func spanBuilder(name: String) -> SpanBuilder {
        return MsrSpanBuilder(name: name,
                              idProvider: idProvider,
                              timeProvider: timeProvider,
                              spanProcessor: spanProcessor,
                              sessionManager: sessionManager,
                              signalSampler: signalSampler,
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
