//
//  MsrObjCSpan.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/05/26.
//

import Foundation

/// Objective-C compatible wrapper for a tracing span.
///
/// Obtain instances via `Measure.startSpan(name:)` or `MsrObjCSpanBuilder.startSpan()`.
/// In Swift, use the `Span` protocol directly instead.
///
/// Example:
/// ```objc
/// MsrObjCSpan *span = [Measure startSpanWithName:@"load_data"];
/// // perform work
/// [span setCheckpoint:@"data_fetched"];
/// [span setStatus:MsrSpanStatusOk];
/// [span end];
/// ```
@objc public final class MsrObjCSpan: NSObject {
    static let invalid = MsrObjCSpan(InvalidSpan(), attributeTransformer: BaseAttributeTransformer())

    let span: Span
    private let attributeTransformer: AttributeTransformer

    init(_ span: Span, attributeTransformer: AttributeTransformer) {
        self.span = span
        self.attributeTransformer = attributeTransformer
    }

    /// The unique identifier for the trace this span belongs to.
    @objc public var traceId: String { span.traceId }

    /// The unique identifier for this span.
    @objc public var spanId: String { span.spanId }

    /// The span ID of this span's parent, or nil if this is a root span.
    @objc public var parentId: String? { span.parentId }

    /// Whether this span has been selected for collection and export.
    @objc public var isSampled: Bool { span.isSampled }

    /// Updates the status of this span. No-op if called after the span has ended.
    @objc public func setStatus(_ status: MsrSpanStatus) {
        _ = span.setStatus(status.spanStatus)
    }

    /// Sets the parent span, establishing a hierarchical relationship. No-op if called after the span has ended.
    @objc public func setParent(_ parentSpan: MsrObjCSpan) {
        _ = span.setParent(parentSpan.span)
    }

    /// Adds a checkpoint marking a significant moment during the span's lifetime. No-op if called after the span has ended.
    @objc public func setCheckpoint(_ name: String) {
        _ = span.setCheckpoint(name)
    }

    /// Updates the name of the span. No-op if called after the span has ended.
    @objc public func setName(_ name: String) {
        _ = span.setName(name)
    }

    /// Adds a string attribute to this span.
    @objc public func setAttributeString(_ key: String, value: String) {
        _ = span.setAttribute(key, value: value)
    }

    /// Adds an integer attribute to this span.
    @objc public func setAttributeInt(_ key: String, value: Int) {
        _ = span.setAttribute(key, value: value)
    }

    /// Adds a double attribute to this span.
    @objc public func setAttributeDouble(_ key: String, value: Double) {
        _ = span.setAttribute(key, value: value)
    }

    /// Adds a boolean attribute to this span.
    @objc public func setAttributeBool(_ key: String, value: Bool) {
        _ = span.setAttribute(key, value: value)
    }

    /// Adds multiple attributes to this span. Supported value types: String, Bool, Int, Int64, Float, Double.
    /// Unsupported types are silently ignored.
    @objc public func setAttributes(_ attributes: [String: Any]) {
        _ = span.setAttributes(attributeTransformer.transformAttributes(attributes))
    }

    /// Removes an attribute from this span. No-op if the attribute does not exist.
    @objc public func removeAttribute(_ key: String) {
        _ = span.removeAttribute(key)
    }

    /// Marks this span as completed, recording its end time.
    @objc public func end() {
        _ = span.end()
    }

    /// Marks this span as completed using the specified end time.
    /// - Parameter timestamp: The end time in milliseconds since epoch, obtained via `Measure.getCurrentTime()`.
    @objc(endWithTimestamp:) public func end(timestamp: Int64) {
        _ = span.end(timestamp: timestamp)
    }

    /// Returns true if `end()` has been called on this span.
    @objc public func hasEnded() -> Bool {
        span.hasEnded()
    }

    /// Returns the duration of this span in milliseconds, or 0 if the span has not ended yet.
    @objc public func getDuration() -> Int64 {
        span.getDuration()
    }
}
