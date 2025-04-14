//
//  SpanStatus.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// Specifies the status of the operation for which the span has been created.
public enum SpanStatus: Int {
    /// Default value for all spans.
    case unset = 0

    /// The operation completed successfully.
    case ok = 1 // swiftlint:disable:this identifier_name

    /// The operation ended in a failure.
    case error = 2
}
