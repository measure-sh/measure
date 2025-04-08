//
//  Span.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/04/25.
//

import Foundation

/// Represents a unit of work or operation within a trace.
///
/// A span represents a single operation within a trace. Spans can be nested to form
/// a trace tree that represents the end-to-end execution path of an operation.
/// Each span captures timing data, status, parent-child relationships to provide context
/// about the operation.
///
/// Example:
/// ```
/// let span = Measure.shared.startSpan("load_data")
/// do {
///     // perform work
///     span.setCheckpoint("checkpoint")
///     span.setStatus(.ok)
/// } catch {
///     span.setStatus(.error)
/// } finally {
///     span.end()
/// }
/// ```
public protocol Span {
    /// Gets the unique identifier for the trace this span belongs to.
    ///
    /// - Returns: A unique string identifier generated when the root span of this trace
    /// was created. For example: "4bf92f3577b34da6a3ce929d0e0e4736"
    ///
    /// Note: All spans in the same trace share the same trace ID, allowing correlation of
    /// related operations across a distributed system.
    var traceId: String { get }

    /// Gets the unique identifier for this span.
    ///
    /// - Returns: A unique string identifier generated when this span was created.
    /// For example: "00f067aa0ba902b7"
    ///
    /// Note: Each span in a trace has its own unique span ID, while sharing the same trace ID.
    /// This allows tracking of specific operations within the larger trace context.
    var spanId: String { get }

    /// Gets the span ID of this span's parent, if one exists.
    ///
    /// - Returns: The unique identifier of the parent span, or nil if this is a root span.
    var parentId: String? { get }

    /// Indicates whether this span has been selected for collection and export.
    ///
    /// Sampling is performed using head-based sampling strategy - the decision is made at the root span
    /// and applied consistently to all spans within the same trace. This ensures that traces are either
    /// collected in their entirety or not at all.
    ///
    /// - Returns: true if this span will be sent to the server for analysis,
    /// false if it will be dropped
    ///
    /// Note: The sampling rate can be configured using `MeasureConfig.traceSamplingRate`.
    var isSampled: Bool { get }

    /// Updates the status of this span.
    ///
    /// - Parameter status: The `SpanStatus` to set for this span
    ///
    /// Note: This operation has no effect if called after the span has ended.
    @discardableResult
    func setStatus(_ status: SpanStatus) -> Span

    /// Sets the parent span for this span, establishing a hierarchical relationship.
    ///
    /// - Parameter parentSpan: The span to set as the parent of this span
    ///
    /// Note: This operation has no effect if called after the span has ended.
    @discardableResult
    func setParent(_ parentSpan: Span) -> Span

    /// Adds a checkpoint marking a significant moment during the span's lifetime.
    ///
    /// - Parameter name: A descriptive name for this checkpoint, indicating what it represents
    ///
    /// Note: This operation has no effect if called after the span has ended.
    @discardableResult
    func setCheckpoint(_ name: String) -> Span

    /// Updates the name of the span.
    ///
    /// - Parameter name: The name to identify this span
    ///
    /// Note: This operation has no effect if called after the span has ended.
    @discardableResult
    func setName(_ name: String) -> Span

    /// Adds an attribute to this span.
    ///
    /// - Parameters:
    ///   - key: The name of the attribute
    ///   - value: The value of the attribute
    @discardableResult
    func setAttribute(_ key: String, value: String) -> Span

    /// Adds an attribute to this span.
    ///
    /// - Parameters:
    ///   - key: The name of the attribute
    ///   - value: The value of the attribute
    @discardableResult
    func setAttribute(_ key: String, value: Int) -> Span

    /// Adds an attribute to this span.
    ///
    /// - Parameters:
    ///   - key: The name of the attribute
    ///   - value: The value of the attribute
    @discardableResult
    func setAttribute(_ key: String, value: Double) -> Span

    /// Adds an attribute to this span.
    ///
    /// - Parameters:
    ///   - key: The name of the attribute
    ///   - value: The value of the attribute
    @discardableResult
    func setAttribute(_ key: String, value: Bool) -> Span

    /// Adds multiple attributes to this span.
    ///
    /// - Parameter attributes: A dictionary of attribute names to values
    @discardableResult
    func setAttributes(_ attributes: [String: Any]) -> Span

    /// Removes an attribute from this span. No-op if the attribute does not exist.
    ///
    /// - Parameter key: The name of the attribute to remove
    @discardableResult
    func removeAttribute(_ key: String) -> Span

    /// Marks this span as completed, recording its end time.
    ///
    /// Note: This method can be called only once per span. Subsequent calls will have no effect.
    @discardableResult
    func end() -> Span

    /// Marks this span as completed using the specified end time.
    ///
    /// - Parameter timestamp: The end time in milliseconds since epoch
    ///
    /// Note: This method can be called only once per span. Subsequent calls will have no effect.
    /// Use this variant when you need to trace an operation that has already completed and you
    /// have captured its end time.
    @discardableResult
    func end(timestamp: Int64) -> Span

    /// Checks if this span has been completed.
    ///
    /// - Returns: true if `end()` has been called on this span, false otherwise
    func hasEnded() -> Bool

    /// Gets the total duration of this span in milliseconds.
    ///
    /// - Returns: The time elapsed between span start and end in milliseconds, or 0 if the span
    /// hasn't ended yet
    ///
    /// Note: Duration is only available after calling `end()` on the span. For ongoing spans,
    /// this method returns 0.
    func getDuration() -> Int64
}
