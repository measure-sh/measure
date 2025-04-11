//
//  Tracer.swift
//  Measure
//
//  Created by Adwin Ross on 10/04/25.
//

import Foundation

/// A protocol to create and manage tracing spans.
protocol Tracer {
    func spanBuilder(name: String) -> SpanBuilder
    func getTraceParentHeaderValue(for span: Span) -> String
    func getTraceParentHeaderKey() -> String
}
