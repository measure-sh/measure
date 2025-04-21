//
//  InternalSpan.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// Internal interface that extends `Span` with additional functionality needed by the SDK.
protocol InternalSpan: Span {
    /// Gets the name identifying this span.
    var name: String { get }

    /// Gets the session identifier associated with this span. A v4-UUID string.
    var sessionId: String { get }

    /// Gets the timestamp when this span was started.
    var startTime: Number { get }

    /// Gets the list of time-based checkpoints added to this span.
    var checkpoints: [Checkpoint] { get }

    /// Gets the map of attributes attached to this span.
    var attributes: Attributes? { get }

    /// Gets the current status of this span, indicating its outcome or error state.
    func getStatus() -> SpanStatus

    /// Returns a modifiable map of user-defined attributes.
    func getUserDefinedAttrs() -> [String: AttributeValue]

    /// Adds an attribute to this span.
    func setInternalAttribute(_ attribute: Attributes)

    /// Converts the span to a data class for further processing and export.
    func toSpanData() -> SpanData
}
