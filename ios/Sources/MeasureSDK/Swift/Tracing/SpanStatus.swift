//
//  SpanStatus.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// Specifies the status of the operation for which the span has been created.
public enum SpanStatus: Int64, Codable {
    case unset = 0
    case ok = 1
    case error = 2
}
