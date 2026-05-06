//
//  MsrObjCSpanBuilder.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/05/26.
//

import Foundation

/// Objective-C compatible wrapper for configuring and creating a new span.
///
/// Obtain instances via `Measure.createSpanBuilder(name:)`.
/// In Swift, use the `SpanBuilder` protocol directly instead.
///
/// Example:
/// ```objc
/// MsrObjCSpanBuilder *builder = [Measure createSpanBuilderWithName:@"load_data"];
/// [builder setParent:parentSpan];
/// MsrObjCSpan *span = [builder startSpan];
/// ```
@objc public final class MsrObjCSpanBuilder: NSObject {
    private let builder: SpanBuilder
    private let attributeTransformer: AttributeTransformer

    init(_ builder: SpanBuilder, attributeTransformer: AttributeTransformer) {
        self.builder = builder
        self.attributeTransformer = attributeTransformer
    }

    /// Sets the parent span for the span being built. Returns the builder for method chaining.
    @discardableResult
    @objc public func setParent(_ span: MsrObjCSpan) -> MsrObjCSpanBuilder {
        _ = builder.setParent(span.span)
        return self
    }

    /// Creates and starts a new span with the current time.
    @objc public func startSpan() -> MsrObjCSpan {
        MsrObjCSpan(builder.startSpan(), attributeTransformer: attributeTransformer)
    }

    /// Creates and starts a new span with the specified start time.
    /// - Parameter timestamp: The start time in milliseconds since epoch, obtained via `Measure.getCurrentTime()`.
    @objc(startSpanWithTimestamp:) public func startSpan(timestamp: Int64) -> MsrObjCSpan {
        MsrObjCSpan(builder.startSpan(timestamp), attributeTransformer: attributeTransformer)
    }
}
